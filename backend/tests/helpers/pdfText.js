/**
 * Extracts human-readable text from an uncompressed pdfkit buffer by decoding
 * the hex-encoded TJ text runs, so tests can assert on operator-facing copy.
 * @param {Buffer} buffer
 * @returns {string}
 */
const extractPdfText = (buffer) => {
  const raw = buffer.toString('latin1');
  const parts = [];

  for (const run of raw.matchAll(/\[((?:<[0-9a-fA-F]+>|[-\d. ]+)+)\] TJ/g)) {
    let text = '';
    for (const hex of run[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
      text += Buffer.from(hex[1], 'hex').toString('latin1');
    }
    parts.push(text);
  }

  return parts.join('\n');
};

module.exports = { extractPdfText };
