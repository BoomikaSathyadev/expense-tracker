const fs = require('fs');
const zlib = require('zlib');

function createIcon(size) {
  const buf = Buffer.alloc(size * size * 3);

  // Background: #1a1a1a dark
  for (let i = 0; i < size * size; i++) {
    buf[i * 3] = 0x1a; buf[i * 3 + 1] = 0x1a; buf[i * 3 + 2] = 0x1a;
  }

  // Anti-aliased pixel setter
  function setPixel(x, y, alpha) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 3;
    const a = alpha / 255;
    buf[i]     = Math.round(buf[i]     + (255 - buf[i])     * a);
    buf[i + 1] = Math.round(buf[i + 1] + (255 - buf[i + 1]) * a);
    buf[i + 2] = Math.round(buf[i + 2] + (255 - buf[i + 2]) * a);
  }

  function fillRect(x1, y1, x2, y2) {
    for (let y = Math.max(0, Math.floor(y1)); y <= Math.min(size-1, Math.ceil(y2)); y++) {
      for (let x = Math.max(0, Math.floor(x1)); x <= Math.min(size-1, Math.ceil(x2)); x++) {
        setPixel(x, y, 255);
      }
    }
  }

  function drawLine(x1, y1, x2, y2, thickness) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const steps = Math.ceil(len * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + dx * t;
      const cy = y1 + dy * t;
      const half = thickness / 2;
      fillRect(cx - half, cy - half, cx + half, cy + half);
    }
  }

  // ₹ symbol geometry — scaled to icon size
  // Using proportions that look good at all sizes
  const pad  = size * 0.22;        // left padding
  const rpad = size * 0.78;        // right edge
  const top  = size * 0.18;        // top of symbol
  const bot  = size * 0.82;        // bottom of symbol
  const sw   = size * 0.09;        // stroke width
  const mid1 = top + (bot - top) * 0.28;  // first crossbar y
  const mid2 = top + (bot - top) * 0.52;  // second crossbar y

  // Vertical stem (left side)
  fillRect(pad, top, pad + sw, bot);

  // Top horizontal bar (full width)
  fillRect(pad, top, rpad, top + sw);

  // First crossbar
  fillRect(pad, mid1, rpad, mid1 + sw);

  // Second crossbar (shorter, above diagonal start)
  fillRect(pad, mid2, rpad * 0.85, mid2 + sw);

  // Diagonal from second crossbar down to bottom-right
  drawLine(pad + sw * 1.2, mid2 + sw, rpad, bot, sw);

  return encodePNG(size, buf);
}

function encodePNG(size, rgb) {
  function crc32(b) {
    let c = 0xFFFFFFFF;
    for (const byte of b) { c ^= byte; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function chunk(type, data) {
    const t = Buffer.from(type);
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([l, t, data, c]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const i192 = createIcon(192);
const i512 = createIcon(512);
const i32  = createIcon(32);

fs.writeFileSync('public/icon-192.png', i192);
fs.writeFileSync('public/icon-512.png', i512);
fs.writeFileSync('app/icon.png', i32);

console.log('icon-192.png:', i192.length, 'bytes');
console.log('icon-512.png:', i512.length, 'bytes');
console.log('app/icon.png:', i32.length, 'bytes');
