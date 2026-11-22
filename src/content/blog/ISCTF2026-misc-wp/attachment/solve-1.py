"""Recover the QR code from the coordinate PNG and its corresponding video.

pip install numpy pillow imageio-ffmpeg qrcode zxing-cpp
python solve.py --image IMAGE.png --video VIDEO.mp4 --output result
"""
from pathlib import Path
import argparse
import math
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', type=Path, required=True)
    parser.add_argument('--video', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('result'))
    parser.add_argument('--packages', type=Path, help='Optional local dependency directory')
    args = parser.parse_args()
    if args.packages:
        sys.path.insert(0, str(args.packages.resolve()))
    import numpy as np
    from PIL import Image
    import imageio_ffmpeg
    import qrcode
    import zxingcpp

    args.output.mkdir(parents=True, exist_ok=True)
    container = np.array(Image.open(args.image).convert('L'), dtype=np.uint8).ravel()
    # Each coordinate is two little-endian uint16 values. FF FF FF FF is padding.
    usable = container[:len(container) // 4 * 4]
    pairs = np.frombuffer(usable.tobytes(), dtype='<u2').reshape(-1, 2)
    end = np.flatnonzero((pairs == 65535).all(axis=1))
    coords = pairs[:int(end[0])] if len(end) else pairs
    size = math.isqrt(len(coords))
    if size * size != len(coords) or size != 37:
        raise ValueError(f'Expected 37x37 coordinates, found {len(coords)}')
    print(f'{len(coords)} coordinates -> {size}x{size} QR matrix', flush=True)

    reader = imageio_ffmpeg.read_frames(str(args.video), pix_fmt='rgb24')
    metadata = next(reader)
    width, height = metadata['size']
    patches = np.empty((len(coords), 25, 25), dtype=np.float64)
    try:
        for i, (x, y) in enumerate(coords.astype(int)):
            frame = np.frombuffer(next(reader), dtype=np.uint8).reshape(height, width, 3)
            xs = np.clip(np.arange(x - 12, x + 13), 0, width - 1)
            ys = np.clip(np.arange(y - 12, y + 13), 0, height - 1)
            patches[i] = frame[ys[:, None], xs[None, :]].mean(axis=2)
    finally:
        reader.close()

    # The QR function patterns have fixed values independent of the payload.
    # Leave format information and data modules unknown.
    qr = qrcode.QRCode(version=5, border=0)
    qr.modules_count = size
    qr.modules = [[None] * size for _ in range(size)]
    for row, col in [(0, 0), (size - 7, 0), (0, size - 7)]:
        qr.setup_position_probe_pattern(row, col)
    qr.setup_position_adjust_pattern()
    qr.setup_timing_pattern()
    qr.modules[size - 8][8] = True
    known = np.array([v is not None for row in qr.modules for v in row])
    labels = np.array([bool(v) for row in qr.modules for v in row])

    # The embedded 8x8 brightness block is mixed with manga backgrounds.
    # Learn a regularized spatial filter from the 260 known function modules.
    features = patches.reshape(len(coords), -1)
    features = (features - features.mean(axis=1, keepdims=True)) / 50.0
    features = np.column_stack([np.ones(len(coords)), features])
    train = features[known]
    targets = labels[known] * 2.0 - 1.0
    kernel = train @ train.T
    reg = 10.0
    # Check the filter on held-out function modules before using it on data.
    folds = np.random.default_rng(67).integers(0, 5, len(targets))
    predicted = np.empty(len(targets))
    for fold in range(5):
        mask = folds != fold
        alpha = np.linalg.solve(kernel[mask][:, mask] + reg * np.eye(mask.sum()), targets[mask])
        predicted[~mask] = kernel[~mask][:, mask] @ alpha
    correct = int(((predicted > 0) == labels[known]).sum())
    print(f'5-fold check on fixed modules: {correct}/{len(targets)}', flush=True)

    alpha = np.linalg.solve(kernel + reg * np.eye(len(targets)), targets)
    confidence = features @ train.T @ alpha
    np.save(args.output / 'confidence.npy', confidence.reshape(size, size))
    for threshold in [-0.2, -0.1, 0.0, 0.1, 0.2]:
        bits = (confidence > threshold).reshape(size, size)
        pixels = np.pad((~bits).astype(np.uint8) * 255, 4, constant_values=255)
        pixels = np.repeat(np.repeat(pixels, 8, axis=0), 8, axis=1)
        results = zxingcpp.read_barcodes(pixels, formats=zxingcpp.BarcodeFormat.QRCode)
        results = [r for r in results if r.valid and r.text]
        if results:
            flag = results[0].text
            Image.fromarray(pixels).save(args.output / 'recovered_qr.png')
            (args.output / 'flag.txt').write_text(flag + '\n', encoding='utf-8')
            print(f'QR decoder verified: {flag}')
            return
    raise RuntimeError('No valid QR payload; do not treat an unverified decoder result as a flag')


if __name__ == '__main__':
    main()
