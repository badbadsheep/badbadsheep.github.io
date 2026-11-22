#!/usr/bin/env python3
"""Decrypt SMB 3.1.1 AES-GCM traffic from a PCAP/PCAPNG using cracked NTLMv2 passwords.

Example:
  python decrypt_smb3.py admin.pcapng -o _decrypted \
      --pass winuser:haha --pass Administrator:haha123

The script reconstructs TCP streams by the complete endpoint tuple, validates
NTLMv2 proofs, derives the SMB 3.1.1 keys from the pre-authentication hash,
verifies every SMB transform tag, and reassembles SMB2 READ responses into
files.  It never truncates extracted files based on guessed offsets.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

try:
    from Crypto.Cipher import AES, ARC4
    from Crypto.Hash import MD4
    from scapy.all import IP, IPv6, TCP, PcapNgReader, PcapReader
except ImportError as exc:  # pragma: no cover - environment diagnostic
    raise SystemExit(
        "Missing dependency. Install with: python -m pip install scapy pycryptodome"
    ) from exc


SMB2 = b"\xfeSMB"
TRANSFORM = b"\xfdSMB"
NTLMSSP = b"NTLMSSP\x00"
SMB2_NEGOTIATE = 0
SMB2_SESSION_SETUP = 1
SMB2_TREE_CONNECT = 3
SMB2_CREATE = 5
SMB2_READ = 8
STATUS_SUCCESS = 0
STATUS_MORE_PROCESSING_REQUIRED = 0xC0000016
SMB311_DIALECT = 0x0311


Endpoint = tuple[str, int]
FlowKey = tuple[Endpoint, Endpoint]  # (client, server)


@dataclass
class Stream:
    data: bytes
    gaps: list[tuple[int, int]]
    conflicts: int


@dataclass
class SMBRecord:
    direction: str  # c2s or s2c
    data: bytes


@dataclass
class SessionKeys:
    username: str
    domain: str
    session_id: bytes
    preauth_hash: bytes
    c2s: bytes
    s2c: bytes


def _ip_layer(pkt):
    return pkt.getlayer(IP) or pkt.getlayer(IPv6)


def read_capture(path: Path) -> dict[FlowKey, dict[str, list[tuple[int, bytes]]]]:
    """Collect TCP payload segments, separated by connection and direction."""
    flows: dict[FlowKey, dict[str, list[tuple[int, bytes]]]] = defaultdict(
        lambda: {"c2s": [], "s2c": []}
    )
    reader_cls = PcapNgReader if path.suffix.lower() in {".pcapng", ".ng"} else PcapReader
    for pkt in reader_cls(str(path)):
        if TCP not in pkt:
            continue
        tcp = pkt[TCP]
        payload = bytes(tcp.payload)
        if not payload:
            continue
        ip = _ip_layer(pkt)
        if ip is None:
            continue
        src = (str(ip.src), int(tcp.sport))
        dst = (str(ip.dst), int(tcp.dport))
        if dst[1] == 445:
            client, server, direction = src, dst, "c2s"
        elif src[1] == 445:
            client, server, direction = dst, src, "s2c"
        else:
            continue
        flows[(client, server)][direction].append((int(tcp.seq), payload))
    return dict(flows)


def reassemble_tcp(segments: list[tuple[int, bytes]]) -> Stream:
    """Reassemble a unidirectional TCP byte stream and report gaps/conflicts.

    Longer retransmissions at an identical sequence number are preferred over
    short, conflicting capture artifacts. Partial overlaps are checked and
    only the not-yet-covered suffix is appended.
    """
    if not segments:
        return Stream(b"", [], 0)
    base_seq = segments[0][0]
    normalized: list[tuple[int, bytes]] = []
    for seq, payload in segments:
        offset = (seq - base_seq) & 0xFFFFFFFF
        if offset > 0x7FFFFFFF:
            offset -= 0x100000000
        normalized.append((offset, payload))
    shift = -min(off for off, _ in normalized)
    normalized = [(off + shift, data) for off, data in normalized]
    normalized.sort(key=lambda item: (item[0], -len(item[1])))

    output = bytearray()
    gaps: list[tuple[int, int]] = []
    conflicts = 0
    for offset, payload in normalized:
        if offset > len(output):
            gaps.append((len(output), offset))
            output.extend(b"\x00" * (offset - len(output)))
        overlap = max(0, len(output) - offset)
        overlap = min(overlap, len(payload))
        if overlap:
            start = offset
            if output[start : start + overlap] != payload[:overlap]:
                conflicts += 1
        if overlap < len(payload):
            output.extend(payload[overlap:])
    return Stream(bytes(output), gaps, conflicts)


def split_netbios_stream(stream: bytes) -> tuple[list[bytes], str | None]:
    """Split NetBIOS Session Service length-prefixed SMB records."""
    records: list[bytes] = []
    pos = 0
    while pos + 4 <= len(stream):
        msg_type = stream[pos]
        length = int.from_bytes(stream[pos + 1 : pos + 4], "big")
        end = pos + 4 + length
        if msg_type != 0:
            return records, f"unexpected NetBIOS message type 0x{msg_type:02x} at {pos}"
        if length == 0:  # Session keepalive.
            pos += 4
            continue
        if end > len(stream):
            return records, f"truncated NetBIOS record at {pos}: needs {length}, has {len(stream)-pos-4}"
        records.append(stream[pos + 4 : end])
        pos = end
    trailer = stream[pos:]
    if trailer and any(trailer):
        return records, f"non-zero trailing TCP bytes at offset {pos}"
    return records, None


def smb2_compounds(data: bytes) -> Iterable[bytes]:
    """Yield SMB2 messages in a possibly compounded plaintext record."""
    pos = 0
    while pos + 64 <= len(data) and data[pos : pos + 4] == SMB2:
        next_command = int.from_bytes(data[pos + 20 : pos + 24], "little")
        if next_command:
            if next_command < 64 or pos + next_command > len(data):
                return
            end = pos + next_command
        else:
            end = len(data)
        yield data[pos:end]
        if not next_command:
            return
        pos = end


def smb_command(msg: bytes) -> int:
    return int.from_bytes(msg[12:14], "little")


def smb_message_id(msg: bytes) -> int:
    return int.from_bytes(msg[24:32], "little")


def smb_flags(msg: bytes) -> int:
    return int.from_bytes(msg[16:20], "little")


def smb_status(msg: bytes) -> int:
    return int.from_bytes(msg[8:12], "little")


def smb_tree_id(msg: bytes) -> int:
    return int.from_bytes(msg[36:40], "little")


def ntlm_type(blob: bytes) -> int | None:
    pos = blob.find(NTLMSSP)
    if pos < 0 or pos + 12 > len(blob):
        return None
    return int.from_bytes(blob[pos + 8 : pos + 12], "little")


def security_blob(msg: bytes) -> bytes:
    """Return the security buffer in an SMB2 SESSION_SETUP message."""
    if len(msg) < 72 or smb_command(msg) != SMB2_SESSION_SETUP:
        return b""
    is_response = bool(smb_flags(msg) & 1)
    if is_response:
        if len(msg) < 72:
            return b""
        offset = int.from_bytes(msg[68:70], "little")
        length = int.from_bytes(msg[70:72], "little")
    else:
        if len(msg) < 80:
            return b""
        offset = int.from_bytes(msg[76:78], "little")
        length = int.from_bytes(msg[78:80], "little")
    if offset + length > len(msg):
        return b""
    return msg[offset : offset + length]


def ntlm_secbuf(ntlm: bytes, offset: int) -> bytes:
    if len(ntlm) < offset + 8:
        return b""
    length = int.from_bytes(ntlm[offset : offset + 2], "little")
    data_offset = int.from_bytes(ntlm[offset + 4 : offset + 8], "little")
    if data_offset + length > len(ntlm):
        return b""
    return ntlm[data_offset : data_offset + length]


def parse_ntlm(ntlm: bytes, expected_type: int) -> dict:
    if not ntlm.startswith(NTLMSSP) or len(ntlm) < 12:
        raise ValueError("missing NTLMSSP signature")
    actual_type = int.from_bytes(ntlm[8:12], "little")
    if actual_type != expected_type:
        raise ValueError(f"expected NTLM message type {expected_type}, got {actual_type}")
    if expected_type == 2:
        if len(ntlm) < 32:
            raise ValueError("short NTLM type-2 message")
        return {"challenge": ntlm[24:32]}
    if expected_type != 3 or len(ntlm) < 64:
        raise ValueError("short or unsupported NTLM message")
    flags = int.from_bytes(ntlm[60:64], "little")
    unicode = bool(flags & 0x00000001)
    encoding = "utf-16le" if unicode else "latin1"

    def text_field(offset: int) -> str:
        return ntlm_secbuf(ntlm, offset).decode(encoding, errors="replace")

    return {
        "lm_response": ntlm_secbuf(ntlm, 12),
        "nt_response": ntlm_secbuf(ntlm, 20),
        "domain": text_field(28),
        "username": text_field(36),
        "encrypted_session_key": ntlm_secbuf(ntlm, 52),
        "flags": flags,
    }


def find_negotiate_pair(
    client_records: list[bytes], server_records: list[bytes]
) -> tuple[bytes, bytes, int]:
    client_negs: dict[int, bytes] = {}
    server_negs: dict[int, bytes] = {}
    for record in client_records:
        for msg in smb2_compounds(record):
            if smb_command(msg) == SMB2_NEGOTIATE and not (smb_flags(msg) & 1):
                # Dialects begin at offset 100 for SMB2 NEGOTIATE requests.
                count = int.from_bytes(msg[66:68], "little") if len(msg) >= 100 else 0
                dialects = {
                    int.from_bytes(msg[100 + 2 * i : 102 + 2 * i], "little")
                    for i in range(count)
                    if 102 + 2 * i <= len(msg)
                }
                if SMB311_DIALECT in dialects:
                    client_negs[smb_message_id(msg)] = msg
    for record in server_records:
        for msg in smb2_compounds(record):
            if smb_command(msg) == SMB2_NEGOTIATE and smb_flags(msg) & 1:
                if len(msg) >= 70 and int.from_bytes(msg[68:70], "little") == SMB311_DIALECT:
                    server_negs[smb_message_id(msg)] = msg
    for mid in sorted(client_negs.keys() & server_negs.keys()):
        return client_negs[mid], server_negs[mid], mid
    raise ValueError("no matching SMB 3.1.1 NEGOTIATE request/response pair")


def find_ntlm_handshake(
    client_records: list[bytes], server_records: list[bytes], negotiate_mid: int
) -> tuple[bytes, bytes, list[tuple[int, bool, bytes]]]:
    """Return NTLM type 2/3 messages and ordered SMB preauth messages."""
    requests: list[tuple[int, bool, bytes]] = []
    challenges: list[bytes] = []
    type3_msg = None
    for records, is_client in ((client_records, True), (server_records, False)):
        for record in records:
            for msg in smb2_compounds(record):
                if smb_command(msg) != SMB2_SESSION_SETUP:
                    continue
                mid = smb_message_id(msg)
                if mid <= negotiate_mid:
                    continue
                blob = security_blob(msg)
                typ = ntlm_type(blob)
                requests.append((mid, not is_client, msg))
                if typ == 2 and not is_client:
                    pos = blob.find(NTLMSSP)
                    challenges.append(blob[pos:])
                elif typ == 3 and is_client:
                    type3_msg = msg
    if not challenges:
        raise ValueError("NTLM type-2 challenge not found")
    if type3_msg is None:
        raise ValueError("NTLM type-3 authentication request not found")
    type3_mid = smb_message_id(type3_msg)
    type2 = parse_ntlm(challenges[-1], 2)
    type3_blob = security_blob(type3_msg)
    pos = type3_blob.find(NTLMSSP)
    type3 = type3_blob[pos:]
    # SMB3.1.1 preauth includes both negotiation messages followed by setup
    # messages through (and including) the request carrying NTLM type 3.
    ordered = [(negotiate_mid, False, b"NEGOTIATE_REQUEST")]
    # The caller replaces these markers with the exact NEGOTIATE records.
    ordered.extend(
        (mid, is_response, msg)
        for mid, is_response, msg in requests
        if mid <= type3_mid and not (smb_status(msg) == 0x000002FF)
    )
    # Remove server's 0x02ff wildcard negotiate response naturally by only
    # including SESSION_SETUP here; requests currently contain only cmd 1.
    return challenges[-1], type3, ordered


def preauth_hash(
    negotiate_request: bytes,
    negotiate_response: bytes,
    setup_records: list[tuple[int, bool, bytes]],
) -> bytes:
    digest = b"\x00" * 64
    messages = [negotiate_request, negotiate_response]
    # `is_response` sorts responses after requests with the same MessageId.
    for _, _, message in sorted(setup_records, key=lambda x: (x[0], x[1])):
        messages.append(message)
        if smb_command(message) == SMB2_SESSION_SETUP:
            blob = security_blob(message)
            if ntlm_type(blob) == 3 and not (smb_flags(message) & 1):
                break
    for message in messages:
        digest = hashlib.sha512(digest + message).digest()
    return digest


def derive_ntlmv2_session_key(
    type2_msg: bytes, type3_msg: bytes, credentials: list[tuple[str, str]]
) -> tuple[str, str, bytes]:
    t2 = parse_ntlm(type2_msg, 2)
    t3 = parse_ntlm(type3_msg, 3)
    response = t3["nt_response"]
    if len(response) < 16:
        raise ValueError("NTLMv2 response is shorter than NTProofStr")
    proof, blob = response[:16], response[16:]
    challenge = t2["challenge"]
    username, domain = t3["username"], t3["domain"]
    for supplied_user, password in credentials:
        if supplied_user.casefold() != username.casefold():
            continue
        password_hash = MD4.new(password.encode("utf-16le")).digest()
        for domain_variant in dict.fromkeys((domain, domain.upper())):
            identity = (username.upper() + domain_variant).encode("utf-16le")
            response_key = hmac.new(password_hash, identity, hashlib.md5).digest()
            expected = hmac.new(response_key, challenge + blob, hashlib.md5).digest()
            if not hmac.compare_digest(expected, proof):
                continue
            key_exchange_key = hmac.new(response_key, proof, hashlib.md5).digest()
            if t3["flags"] & 0x40000000:
                encrypted = t3["encrypted_session_key"]
                if not encrypted:
                    raise ValueError("NTLM key exchange is set but encrypted session key is empty")
                session_key = ARC4.new(key_exchange_key).decrypt(encrypted)
            else:
                session_key = key_exchange_key
            return username, domain, session_key
    raise ValueError(f"no supplied password validated the NTLMv2 proof for {username}")


def sp800_108_counter_kdf(key: bytes, label: bytes, context: bytes, bits: int) -> bytes:
    result = bytearray()
    counter = 1
    while len(result) * 8 < bits:
        block = (
            counter.to_bytes(4, "big")
            + label
            + b"\x00"
            + context
            + bits.to_bytes(4, "big")
        )
        result.extend(hmac.new(key, block, hashlib.sha256).digest())
        counter += 1
    return bytes(result[: bits // 8])


def negotiate_contexts(response: bytes) -> tuple[int | None, int | None]:
    """Return (preauth hash algorithm, first advertised encryption cipher)."""
    if len(response) < 128:
        return None, None
    count = int.from_bytes(response[70:72], "little")
    offset = int.from_bytes(response[124:128], "little")
    pos = offset
    hash_algorithm = None
    cipher = None
    for _ in range(count):
        if pos + 8 > len(response):
            break
        context_type = int.from_bytes(response[pos : pos + 2], "little")
        data_len = int.from_bytes(response[pos + 2 : pos + 4], "little")
        end = pos + 8 + data_len
        if end > len(response):
            break
        body = response[pos + 8 : end]
        if context_type == 1 and len(body) >= 6:  # PREAUTH_INTEGRITY_CAPABILITIES
            alg_count = int.from_bytes(body[0:2], "little")
            if alg_count:
                hash_algorithm = int.from_bytes(body[4:6], "little")
        elif context_type == 2 and len(body) >= 4:  # ENCRYPTION_CAPABILITIES
            cipher_count = int.from_bytes(body[0:2], "little")
            if cipher_count:
                cipher = int.from_bytes(body[2:4], "little")
        pos = (end + 7) & ~7
    return hash_algorithm, cipher


def derive_session_keys(
    client_records: list[bytes],
    server_records: list[bytes],
    credentials: list[tuple[str, str]],
) -> SessionKeys:
    negotiate_request, negotiate_response, negotiate_mid = find_negotiate_pair(
        client_records, server_records
    )
    algorithm, cipher = negotiate_contexts(negotiate_response)
    if algorithm not in (None, 1):
        raise ValueError(f"unsupported SMB preauth hash algorithm id {algorithm}")
    _, type3, setup_order = find_ntlm_handshake(
        client_records, server_records, negotiate_mid
    )
    # Recompute preauth from exact SMB2 messages, excluding the SMB2 wildcard
    # negotiate response (dialect 0x02ff) and the final successful setup reply.
    context = preauth_hash(negotiate_request, negotiate_response, setup_order[1:])
    type2, _, _ = find_ntlm_handshake(client_records, server_records, negotiate_mid)
    username, domain, session_key = derive_ntlmv2_session_key(type2, type3, credentials)
    c2s_key = sp800_108_counter_kdf(
        session_key, b"SMBC2SCipherKey\x00", context, 128
    )
    s2c_key = sp800_108_counter_kdf(
        session_key, b"SMBS2CCipherKey\x00", context, 128
    )
    # SessionId is the SMB2 header field in the NTLM type-3 request.
    session_id = type3[40:48]
    return SessionKeys(username, domain, session_id, context, c2s_key, s2c_key)


def decrypt_transform(record: bytes, key: bytes) -> bytes:
    if len(record) < 52 or record[:4] != TRANSFORM:
        raise ValueError("not an SMB2 transform record")
    signature = record[4:20]
    nonce = record[20:32]
    aad = record[20:52]
    encrypted = record[52:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce, mac_len=16)
    cipher.update(aad)
    plaintext = cipher.decrypt_and_verify(encrypted, signature)
    original_size = int.from_bytes(record[36:40], "little")
    if len(plaintext) != original_size:
        raise ValueError(
            f"transform length mismatch: header says {original_size}, decrypted {len(plaintext)}"
        )
    return plaintext


def _decode_utf16(raw: bytes) -> str:
    return raw.decode("utf-16le", errors="replace").rstrip("\x00")


def extract_files(records: list[SMBRecord], output_dir: Path, server_ip: str) -> list[tuple[str, int, bool]]:
    """Recover files from SMB2 CREATE/READ request-response pairs."""
    requests: dict[int, tuple[str, object]] = {}
    tree_requests: dict[int, str] = {}
    creates: dict[int, tuple[int, str]] = {}
    reads: dict[int, tuple[int, bytes, int, int]] = {}
    responses: list[bytes] = []

    for item in records:
        for msg in smb2_compounds(item.data):
            command = smb_command(msg)
            response = bool(smb_flags(msg) & 1)
            mid = smb_message_id(msg)
            if item.direction == "c2s" and not response:
                if command == SMB2_TREE_CONNECT and len(msg) >= 72:
                    path_offset = int.from_bytes(msg[68:70], "little")
                    path_len = int.from_bytes(msg[70:72], "little")
                    path = _decode_utf16(msg[path_offset : path_offset + path_len])
                    tree_requests[mid] = path
                elif command == SMB2_CREATE and len(msg) >= 120:
                    name_offset = int.from_bytes(msg[108:110], "little")
                    name_len = int.from_bytes(msg[110:112], "little")
                    name = _decode_utf16(msg[name_offset : name_offset + name_len])
                    creates[mid] = (smb_tree_id(msg), name)
                elif command == SMB2_READ and len(msg) >= 96:
                    length = int.from_bytes(msg[68:72], "little")
                    offset = int.from_bytes(msg[72:80], "little")
                    file_id = msg[80:96]
                    reads[mid] = (smb_tree_id(msg), file_id, offset, length)
            elif item.direction == "s2c" and response:
                responses.append(msg)

    tree_shares: dict[int, str] = {}
    file_meta: dict[tuple[int, bytes], tuple[str, int]] = {}
    chunks: dict[tuple[int, bytes], list[tuple[int, bytes]]] = defaultdict(list)
    expected_sizes: dict[tuple[int, bytes], int] = {}

    for msg in responses:
        command = smb_command(msg)
        status = smb_status(msg)
        mid = smb_message_id(msg)
        tree_id = smb_tree_id(msg)
        if status != STATUS_SUCCESS:
            continue
        if command == SMB2_TREE_CONNECT and mid in tree_requests:
            tree_shares[tree_id] = tree_requests[mid]
        elif command == SMB2_CREATE and mid in creates and len(msg) >= 144:
            req_tree, name = creates[mid]
            file_id = msg[128:144]
            eof = int.from_bytes(msg[112:120], "little")
            key = (req_tree or tree_id, file_id)
            file_meta[key] = (name, eof)
            expected_sizes[key] = eof
        elif command == SMB2_READ and mid in reads and len(msg) >= 80:
            req_tree, file_id, offset, requested = reads[mid]
            data_offset = msg[66]
            data_len = int.from_bytes(msg[68:72], "little")
            if data_offset + data_len > len(msg):
                continue
            data = msg[data_offset : data_offset + data_len]
            key = (req_tree or tree_id, file_id)
            chunks[key].append((offset, data))

    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[tuple[str, int, bool]] = []
    for key, pieces in chunks.items():
        name, eof = file_meta.get(key, (key[1].hex(), expected_sizes.get(key, 0)))
        size = eof or max((offset + len(data) for offset, data in pieces), default=0)
        buffer = bytearray(size)
        coverage = bytearray(size)
        for offset, data in pieces:
            if offset >= size:
                continue
            take = min(len(data), size - offset)
            buffer[offset : offset + take] = data[:take]
            coverage[offset : offset + take] = b"\x01" * take
        complete = bool(size) and all(coverage)
        unc = tree_shares.get(key[0], "")
        share = unc.rstrip("\\/").split("\\")[-1] if unc else f"tree{key[0]:08x}"
        safe_name = re.sub(r"[^A-Za-z0-9._$-]+", "_", name.replace("\\", "_").replace("/", "_"))
        safe_share = re.sub(r"[^A-Za-z0-9._$-]+", "_", share)
        filename = f"{server_ip}_{safe_share}_{safe_name}".strip("_")
        target = output_dir / filename
        target.write_bytes(buffer)
        results.append((str(target), size, complete))
    return results


def parse_credential(value: str) -> tuple[str, str]:
    if ":" not in value:
        raise argparse.ArgumentTypeError("credential must be USER:PASSWORD")
    user, password = value.split(":", 1)
    if not user:
        raise argparse.ArgumentTypeError("credential username cannot be empty")
    return user, password


def process_flow(
    key: FlowKey,
    directions: dict[str, list[tuple[int, bytes]]],
    credentials: list[tuple[str, str]],
    output_dir: Path,
) -> tuple[int, int, list[tuple[str, int, bool]]]:
    streams = {direction: reassemble_tcp(directions[direction]) for direction in ("c2s", "s2c")}
    all_records: dict[str, list[bytes]] = {}
    for direction, stream in streams.items():
        if stream.gaps:
            raise ValueError(f"{direction} TCP stream has sequence gaps: {stream.gaps[:5]}")
        records, error = split_netbios_stream(stream.data)
        if error:
            raise ValueError(f"{direction} TCP framing error: {error}")
        all_records[direction] = records

    keys = derive_session_keys(all_records["c2s"], all_records["s2c"], credentials)
    smb_records: list[SMBRecord] = []
    for direction in ("c2s", "s2c"):
        stream_key = keys.c2s if direction == "c2s" else keys.s2c
        for record in all_records[direction]:
            if record.startswith(SMB2):
                smb_records.append(SMBRecord(direction, record))

    verified = 0
    failed = 0
    for direction in ("c2s", "s2c"):
        stream_key = keys.c2s if direction == "c2s" else keys.s2c
        for index, record in enumerate(all_records[direction]):
            if not record.startswith(TRANSFORM):
                continue
            try:
                plaintext = decrypt_transform(record, stream_key)
            except Exception as exc:
                failed += 1
                print(
                    f"[!] {key[0][0]}:{key[0][1]} -> {key[1][0]} "
                    f"{direction} transform #{index}: {exc}",
                    file=sys.stderr,
                )
                continue
            verified += 1
            smb_records.append(SMBRecord(direction, plaintext))

    files = extract_files(smb_records, output_dir, key[1][0])
    print(
        f"[+] {key[0][0]}:{key[0][1]} -> {key[1][0]}:445 "
        f"user={keys.username} domain={keys.domain} "
        f"preauth={keys.preauth_hash.hex()} GCM={verified} verified/{failed} failed"
    )
    for filename, size, complete in files:
        state = "complete" if complete else "has gaps"
        print(f"    extracted {filename} ({size} bytes, {state})")
    return verified, failed, files


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("capture", type=Path, help="input .pcap or .pcapng")
    parser.add_argument("-o", "--output", type=Path, default=Path("_decrypted"))
    parser.add_argument(
        "--pass",
        dest="credentials",
        action="append",
        type=parse_credential,
        required=True,
        metavar="USER:PASSWORD",
        help="cracked NTLMv2 password; may be repeated for multiple users",
    )
    args = parser.parse_args()
    if not args.capture.is_file():
        parser.error(f"capture not found: {args.capture}")

    flows = read_capture(args.capture)
    if not flows:
        parser.error("no TCP/445 payloads found")
    total_verified = 0
    total_failed = 0
    total_files = 0
    for key, directions in flows.items():
        if not directions["c2s"] or not directions["s2c"]:
            print(f"[-] skipping incomplete connection {key}")
            continue
        try:
            verified, failed, files = process_flow(
                key, directions, args.credentials, args.output
            )
        except Exception as exc:
            print(f"[-] {key[0][0]}:{key[0][1]} -> {key[1][0]}: {exc}", file=sys.stderr)
            continue
        total_verified += verified
        total_failed += failed
        total_files += len(files)
    print(
        f"[*] summary: verified_transforms={total_verified} "
        f"failed_transforms={total_failed} extracted_files={total_files}"
    )
    return 1 if total_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
