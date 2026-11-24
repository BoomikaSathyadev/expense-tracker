const fs = require('fs');
const zlib = require('zlib');

function verifyPNG(path) {
  const buf = fs.readFileSync(path);
  const sig = [137,80,78,71,13,10,26,10];
  if (!sig.every((b,i) => buf[i] === b)) return console.log(path, 'INVALID SIGNATURE');

  let offset = 8;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset+4, offset+8).toString();
    offset += 12 + len;
    if (type === 'IHDR') {
      const w = buf.readUInt32BE(offset - len - 4);
      const h = buf.readUInt32BE(offset - len);
      console.log(path, '- OK | size:', buf.length, 'bytes | dimensions:', w, 'x', h);
    }
    if (type === 'IEND') break;
  }

  // Try to decompress IDAT
  const idatStart = buf.indexOf(Buffer.from('IDAT'));
  if (idatStart > 0) {
    const idatLen = buf.readUInt32BE(idatStart - 4);
    const idat = buf.slice(idatStart + 4, idatStart + 4 + idatLen);
    try {
      zlib.inflateSync(idat);
      console.log(path, '- IDAT decompresses OK');
    } catch(e) {
      console.log(path, '- IDAT DECOMPRESS FAILED:', e.message);
    }
  }
}

verifyPNG('public/icon-192.png');
verifyPNG('public/icon-512.png');
verifyPNG('app/icon.png');
