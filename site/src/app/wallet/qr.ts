/**
 * Minimal QR code encoder (byte mode, error correction level M, versions 1 to 10) for wallet
 * addresses. Follows ISO/IEC 18004; structure after Project Nayuki's reference implementation.
 */

const ECC_PER_BLOCK_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const FORMAT_ECC_M = 0;

function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK_M[ver]! * BLOCKS_M[ver]!;

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = gfMul(r[j]!, root);
      if (j + 1 < r.length) r[j]! ^= r[j + 1]!;
    }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data: number[], div: number[]): number[] {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift()!;
    r.push(0);
    div.forEach((c, i) => (r[i]! ^= gfMul(c, f)));
  }
  return r;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

export interface QrMatrix {
  size: number;
  /** modules[y][x] true = dark */
  modules: boolean[][];
}

export function encodeQr(text: string): QrMatrix {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (; ver <= 10; ver++) {
    const cc = ver < 10 ? 8 : 16;
    if (4 + cc + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > 10) throw new Error("Text too long for this QR encoder");
  const cap = dataCodewords(ver) * 8;
  const bb: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, cap - bb.length));
  push(0, (8 - (bb.length % 8)) % 8);
  for (let pad = 0xec; bb.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bb.length; i += 8) data.push(bb.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Error correction and interleave
  const nb = BLOCKS_M[ver]!;
  const ecl = ECC_PER_BLOCK_M[ver]!;
  const raw = Math.floor(rawDataModules(ver) / 8);
  const nShort = nb - (raw % nb);
  const shortLen = Math.floor(raw / nb);
  const div = rsDivisor(ecl);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const all: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) blocks.forEach((b, j) => (i !== shortLen - ecl || j >= nShort) && all.push(b[i]!));

  const size = ver * 4 + 17;
  const mod: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setF = (x: number, y: number, d: boolean) => {
    mod[y]![x] = d;
    fn[y]![x] = true;
  };

  for (let i = 0; i < size; i++) {
    setF(6, i, i % 2 === 0);
    setF(i, 6, i % 2 === 0);
  }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    const last = pos.length - 1;
    pos.forEach((px, i) =>
      pos.forEach((py, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(px + dx, py + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }),
    );
  }
  const drawFormat = (mask: number) => {
    const d = (FORMAT_ECC_M << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setF(8, i, bit(bits, i));
    setF(8, 7, bit(bits, 6));
    setF(8, 8, bit(bits, 7));
    setF(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(bits, i));
    setF(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const b = bit(bits, i);
      const a = size - 11 + (i % 3);
      const c = Math.floor(i / 3);
      setF(a, c, b);
      setF(c, a, b);
    }
  }

  // Codewords in the zigzag order
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - v : v;
        if (!fn[y]![x] && i < all.length * 8) {
          mod[y]![x] = bit(all[i >>> 3]!, 7 - (i & 7));
          i++;
        }
      }
  }

  const maskFn = (m: number, x: number, y: number) =>
    [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][m]!;
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y]![x] && maskFn(m, x, y)) mod[y]![x] = !mod[y]![x];
  };
  // Simplified penalty (runs, 2x2 blocks, dark balance) to pick a mask.
  const penalty = () => {
    let p = 0;
    for (let a = 0; a < size; a++) {
      let rx = 1;
      let ry = 1;
      for (let b = 1; b < size; b++) {
        if (mod[a]![b] === mod[a]![b - 1]) rx++;
        else rx = 1;
        if (mod[b]![a] === mod[b - 1]![a]) ry++;
        else ry = 1;
        if (rx === 5) p += 3;
        else if (rx > 5) p++;
        if (ry === 5) p += 3;
        else if (ry > 5) p++;
      }
    }
    let dark = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (mod[y]![x]) dark++;
        if (x < size - 1 && y < size - 1) {
          const c = mod[y]![x];
          if (c === mod[y]![x + 1] && c === mod[y + 1]![x] && c === mod[y + 1]![x + 1]) p += 3;
        }
      }
    const total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  };
  let best = 0;
  let bestP = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const p = penalty();
    if (p < bestP) {
      bestP = p;
      best = m;
    }
    applyMask(m);
  }
  applyMask(best);
  drawFormat(best);
  return { size, modules: mod };
}

/** SVG path data (one unit per module) with a 4 module quiet zone offset. */
export function qrPath(m: QrMatrix, border = 4): string {
  let d = "";
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.modules[y]![x]) d += `M${x + border},${y + border}h1v1h-1z`;
  return d;
}
