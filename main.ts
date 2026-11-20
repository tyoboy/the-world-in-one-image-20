// The World in One Image — 20 November 2026 (Node 22, standard library only).
//
// One picture of Friday 20 November 2026, drawn as a front page: the UN
// court's genocide ruling on Myanmar as the lead, and seven more of the
// day's stories — Trump putting the Iran decision off to 2027, GTA VI
// passing $1.80bn in sales, Cyclone Akvan's landfall in Odisha, Voyager 1
// reaching a full light-day out, Hayabusa2's cancelled asteroid landing,
// Europe ready for talks with Russia, and the Houthi strike on Riyadh.
// The picture ships beside this file as entry.png; the program verifies it
// against the gate's rules (a whole PNG or JPEG, at most 1 MiB, at most
// 1024 by 1024 pixels) and copies it, byte for byte, to /output/entry.png.
// Same input, same bytes out, every run. The picture is drawn once, by a
// deterministic renderer, and never re-drawn at grade time: what the
// grader reads is exactly the file committed here.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const LIMITS = { bytes: 1_048_576, side: 1024 };
const bytes = readFileSync(new URL('./entry.png', import.meta.url));

const problems: string[] = [];
if (bytes.length === 0) problems.push('the file is empty');
if (bytes.length > LIMITS.bytes) problems.push(`${bytes.length} bytes is over the 1 MiB cap`);

const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const kind = pngMagic.every((b, i) => bytes[i] === b)
  ? 'PNG'
  : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ? 'JPEG'
    : null;
if (kind === null) problems.push('the first bytes are neither the PNG nor the JPEG signature');

let width = 0;
let height = 0;
if (kind === 'PNG') {
  if (bytes.length < 24 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    problems.push('no IHDR chunk where a PNG keeps it');
  } else {
    width = bytes.readUInt32BE(16);
    height = bytes.readUInt32BE(20);
  }
  if (bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND') {
    problems.push('the file does not end with an IEND chunk (truncated?)');
  }
}
if (kind === 'JPEG') {
  // A whole JPEG ends FFD9; its start-of-frame segment carries the size.
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    problems.push('the file does not end with the JPEG end-of-image marker (truncated?)');
  }
  for (let at = 2; at + 9 < bytes.length && width === 0;) {
    if (bytes[at] !== 0xff) { at += 1; continue; }
    const marker = bytes[at + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      height = bytes.readUInt16BE(at + 5);
      width = bytes.readUInt16BE(at + 7);
    } else {
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }
  if (width === 0) problems.push('no JPEG start-of-frame segment to read the size from');
}
if (width > LIMITS.side || height > LIMITS.side) {
  problems.push(`the picture is ${width}x${height}, over the ${LIMITS.side} pixel cap`);
}

if (problems.length > 0) {
  for (const p of problems) process.stderr.write(`news-image-20: ${p}\n`);
  process.exit(1);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'entry.png');
writeFileSync(outFile, bytes);
process.stdout.write(
  `news-image-20: wrote ${outFile} (${bytes.length} bytes, ${kind}${width ? `, ${width}x${height}` : ''})\n`,
);
