// the-world-in-one-image-20 — carrier for the 20 November 2026 front page.
//
// The entry is the picture, entry.png, a one-page newspaper for Friday
// 20 November 2026. Its lead is the UN court's genocide ruling on
// Myanmar; the other stories it carries are Trump deferring the Iran
// decision to 2027, GTA VI passing $1.80bn in sales, Cyclone Akvan
// coming ashore in Odisha, Voyager 1 reaching a full light-day out,
// Hayabusa2's cancelled asteroid landing, Europe ready for talks with
// Russia, and the Houthi strike on Riyadh.
//
// This program does only one thing: it checks the picture against the
// gate's rules — whole PNG or JPEG, at most 1 MiB, at most 1024x1024 —
// and copies it byte for byte to /output/entry.png, where the house
// reads it. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22, standard library only.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1_048_576;
const MAX_SIDE = 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function die(message: string): never {
  process.stderr.write(`the-world-in-one-image-20: ${message}\n`);
  process.exit(1);
}

function startsWith(bytes: Buffer, magic: number[]): boolean {
  return magic.every((byte, i) => bytes[i] === byte);
}

function readPngSize(bytes: Buffer): { width: number; height: number } {
  // A PNG opens with its 8-byte signature, then a 4-byte length, the
  // four letters IHDR, and the width and height as two big-endian words.
  if (bytes.length < 33) die('PNG is too short to hold an IHDR chunk');
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') die('PNG has no IHDR chunk at offset 12');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  // The file must close with the IEND chunk: length 0, the letters
  // IEND, and its CRC — twelve bytes in all.
  const tail = bytes.subarray(bytes.length - 12);
  if (tail.readUInt32BE(0) !== 0 || tail.toString('ascii', 4, 8) !== 'IEND') {
    die('PNG has no IEND chunk at the end');
  }
  return { width, height };
}

function readJpegSize(bytes: Buffer): { width: number; height: number } {
  // Walk the JPEG marker segments. A segment is 0xFF, a marker byte,
  // then a big-endian length covering the length field itself. The
  // start-of-frame segment (0xC0-0xCF, except 0xC4, 0xC8 and 0xCC)
  // carries the height and width as two big-endian words.
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    die('JPEG has no FFD9 end marker');
  }
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) die('JPEG has a segment that does not start with 0xFF');
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // standalone markers carry no length field
      continue;
    }
    if (offset + 4 > bytes.length) die('JPEG segment is cut short');
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) die('JPEG segment length runs past the end');
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (length < 7) die('JPEG start-of-frame segment is too short');
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  die('JPEG has no start-of-frame segment');
}

const bytes = readFileSync(new URL('./entry.png', import.meta.url));
if (bytes.length === 0) die('entry.png is empty');
if (bytes.length > MAX_BYTES) die(`entry.png is ${bytes.length} bytes, over the 1 MiB cap`);

let kind: 'PNG' | 'JPEG';
let size: { width: number; height: number };
if (startsWith(bytes, PNG_MAGIC)) {
  kind = 'PNG';
  size = readPngSize(bytes);
} else if (startsWith(bytes, JPEG_MAGIC)) {
  kind = 'JPEG';
  size = readJpegSize(bytes);
} else {
  die('entry.png is neither a PNG nor a JPEG');
}
if (size.width > MAX_SIDE || size.height > MAX_SIDE) {
  die(`image is ${size.width}x${size.height}, over the 1024x1024 cap`);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'entry.png');
writeFileSync(outFile, bytes);
process.stdout.write(
  `the-world-in-one-image-20: wrote ${outFile} (${bytes.length} bytes, ${kind} ${size.width}x${size.height})\n`,
);
