// Proof-of-Work Web Worker
// Finds nonce such that SHA256(challenge + nonce) has `difficulty` leading zero bits

async function sha256hex(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(hashBuf);
  return bytes;
}

function countLeadingZeroBits(bytes) {
  let bits = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8;
    } else {
      let b = byte;
      while ((b & 0x80) === 0) { bits++; b <<= 1; }
      break;
    }
  }
  return bits;
}

self.onmessage = async function(e) {
  const { challenge, difficulty } = e.data;
  let nonce = 0;
  const startTime = Date.now();

  while (true) {
    const nonceStr = nonce.toString();
    const hash = await sha256hex(challenge + nonceStr);
    const zeroBits = countLeadingZeroBits(hash);

    if (zeroBits >= difficulty) {
      self.postMessage({
        type: 'solved',
        nonce: nonceStr,
        attempts: nonce,
        timeMs: Date.now() - startTime,
      });
      return;
    }

    nonce++;

    // Report progress every 50k attempts
    if (nonce % 50000 === 0) {
      self.postMessage({
        type: 'progress',
        attempts: nonce,
        timeMs: Date.now() - startTime,
      });
    }
  }
};
