// Synchronous raw-DEFLATE (RFC 1951) decompression, no dependencies.
// Faithful port of "tinf" / "tiny-inflate" by Joergen Ibsen (public domain / MIT),
// JS port by Devon Govett. Decodes what CompressionStream('deflate-raw') produces.

class Tree {
  // Bit-length count table indexed by code length.
  readonly table = new Uint16Array(16);
  // Symbols sorted by Huffman code.
  readonly trans = new Uint16Array(288);
}

class Data {
  tag = 0;
  bitcount = 0;
  sourceIndex = 0;
  destLen = 0;
  readonly ltree = new Tree();
  readonly dtree = new Tree();

  constructor(
    readonly source: Uint8Array,
    public dest: Uint8Array,
  ) {}
}

// Extra bits and base tables for length and distance codes (RFC 1951 3.2.5).
const lengthBits = new Uint8Array(30);
const lengthBase = new Uint16Array(30);
const distBits = new Uint8Array(30);
const distBase = new Uint16Array(30);

// Fixed literal/length and distance trees for btype 1 blocks.
const sltree = new Tree();
const sdtree = new Tree();

function buildBitsBase(bits: Uint8Array, base: Uint16Array, delta: number, first: number): void {
  let sum = first;
  for (let i = 0; i < delta; ++i) bits[i] = 0;
  for (let i = 0; i < 30 - delta; ++i) bits[i + delta] = Math.floor(i / delta);
  for (let i = 0; i < 30; ++i) {
    base[i] = sum;
    sum += 1 << (bits[i] ?? 0);
  }
}

function buildFixedTrees(lt: Tree, dt: Tree): void {
  for (let i = 0; i < 7; ++i) lt.table[i] = 0;
  lt.table[7] = 24;
  lt.table[8] = 152;
  lt.table[9] = 112;
  for (let i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
  for (let i = 0; i < 144; ++i) lt.trans[24 + i] = i;
  for (let i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
  for (let i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;
  for (let i = 0; i < 5; ++i) dt.table[i] = 0;
  dt.table[5] = 32;
  for (let i = 0; i < 32; ++i) dt.trans[i] = i;
}

function buildTree(t: Tree, lengths: Uint8Array, off: number, num: number): void {
  const offs = new Uint16Array(16);
  for (let i = 0; i < 16; ++i) t.table[i] = 0;
  for (let i = 0; i < num; ++i) {
    const len = lengths[off + i] ?? 0;
    t.table[len] = (t.table[len] ?? 0) + 1;
  }
  t.table[0] = 0;
  let sum = 0;
  for (let i = 0; i < 16; ++i) {
    offs[i] = sum;
    sum += t.table[i] ?? 0;
  }
  for (let i = 0; i < num; ++i) {
    const len = lengths[off + i] ?? 0;
    if (len) {
      t.trans[offs[len] ?? 0] = i;
      offs[len] = (offs[len] ?? 0) + 1;
    }
  }
}

function getBit(d: Data): number {
  if (d.bitcount-- === 0) {
    d.tag = d.source[d.sourceIndex++] ?? 0;
    d.bitcount = 7;
  }
  const bit = d.tag & 1;
  d.tag >>>= 1;
  return bit;
}

function readBits(d: Data, num: number, base: number): number {
  if (!num) return base;
  while (d.bitcount < 24) {
    d.tag |= (d.source[d.sourceIndex++] ?? 0) << d.bitcount;
    d.bitcount += 8;
  }
  const val = d.tag & (0xffff >>> (16 - num));
  d.tag >>>= num;
  d.bitcount -= num;
  return val + base;
}

function decodeSymbol(d: Data, t: Tree): number {
  while (d.bitcount < 24) {
    d.tag |= (d.source[d.sourceIndex++] ?? 0) << d.bitcount;
    d.bitcount += 8;
  }
  let sum = 0;
  let cur = 0;
  let len = 0;
  let tag = d.tag;
  do {
    cur = 2 * cur + (tag & 1);
    tag >>>= 1;
    ++len;
    sum += t.table[len] ?? 0;
    cur -= t.table[len] ?? 0;
  } while (cur >= 0);
  d.tag = tag;
  d.bitcount -= len;
  return t.trans[sum + cur] ?? 0;
}

function decodeTrees(d: Data, lt: Tree, dt: Tree): void {
  const clcidx = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  const lengths = new Uint8Array(288 + 32);
  const hlit = readBits(d, 5, 257);
  const hdist = readBits(d, 5, 1);
  const hclen = readBits(d, 4, 4);
  for (let i = 0; i < 19; ++i) lengths[i] = 0;
  const codeTree = new Tree();
  for (let i = 0; i < hclen; ++i) {
    const clen = readBits(d, 3, 0);
    lengths[clcidx[i] ?? 0] = clen;
  }
  buildTree(codeTree, lengths, 0, 19);
  for (let num = 0; num < hlit + hdist; ) {
    const sym = decodeSymbol(d, codeTree);
    if (sym === 16) {
      const prev = lengths[num - 1] ?? 0;
      for (let length = readBits(d, 2, 3); length; --length) lengths[num++] = prev;
    } else if (sym === 17) {
      for (let length = readBits(d, 3, 3); length; --length) lengths[num++] = 0;
    } else if (sym === 18) {
      for (let length = readBits(d, 7, 11); length; --length) lengths[num++] = 0;
    } else {
      lengths[num++] = sym;
    }
  }
  buildTree(lt, lengths, 0, hlit);
  buildTree(dt, lengths, hlit, hdist);
}

function ensureCapacity(d: Data, extra: number): void {
  const needed = d.destLen + extra;
  if (needed <= d.dest.length) return;
  let next = d.dest.length ? d.dest.length : 1024;
  while (next < needed) next *= 2;
  const grown = new Uint8Array(next);
  grown.set(d.dest.subarray(0, d.destLen));
  d.dest = grown;
}

function inflateBlockData(d: Data, lt: Tree, dt: Tree): void {
  for (;;) {
    const sym = decodeSymbol(d, lt);
    if (sym === 256) return;
    if (sym < 256) {
      ensureCapacity(d, 1);
      d.dest[d.destLen++] = sym;
    } else {
      const lengthSym = sym - 257;
      if (lengthSym >= 30) throw new Error("inflate: invalid length symbol");
      const length = readBits(d, lengthBits[lengthSym] ?? 0, lengthBase[lengthSym] ?? 0);
      const distSym = decodeSymbol(d, dt);
      if (distSym >= 30) throw new Error("inflate: invalid distance symbol");
      const dist = readBits(d, distBits[distSym] ?? 0, distBase[distSym] ?? 0);
      const offs = d.destLen - dist;
      if (offs < 0) throw new Error("inflate: distance too far back");
      ensureCapacity(d, length);
      for (let i = 0; i < length; ++i) d.dest[d.destLen++] = d.dest[offs + i] ?? 0;
    }
  }
}

function inflateUncompressedBlock(d: Data): void {
  while (d.bitcount > 8) {
    d.sourceIndex--;
    d.bitcount -= 8;
  }
  let i = d.sourceIndex;
  const length = (d.source[i + 1] ?? 0) * 256 + (d.source[i] ?? 0);
  const invLength = (d.source[i + 3] ?? 0) * 256 + (d.source[i + 2] ?? 0);
  if (length !== (~invLength & 0x0000ffff)) throw new Error("inflate: stored block length mismatch");
  i += 4;
  ensureCapacity(d, length);
  for (let n = length; n; --n) d.dest[d.destLen++] = d.source[i++] ?? 0;
  d.bitcount = 0;
  d.sourceIndex = i;
}

buildBitsBase(lengthBits, lengthBase, 4, 3);
buildBitsBase(distBits, distBase, 2, 1);
lengthBits[28] = 0;
lengthBase[28] = 258;
buildFixedTrees(sltree, sdtree);

export function inflateRaw(source: Uint8Array): Uint8Array {
  const d = new Data(source, new Uint8Array(source.length ? source.length * 4 : 1024));
  let bfinal = 0;
  do {
    bfinal = getBit(d);
    const btype = readBits(d, 2, 0);
    if (btype === 0) {
      inflateUncompressedBlock(d);
    } else if (btype === 1) {
      inflateBlockData(d, sltree, sdtree);
    } else if (btype === 2) {
      decodeTrees(d, d.ltree, d.dtree);
      inflateBlockData(d, d.ltree, d.dtree);
    } else {
      throw new Error("inflate: invalid block type");
    }
  } while (!bfinal);
  return d.dest.slice(0, d.destLen);
}
