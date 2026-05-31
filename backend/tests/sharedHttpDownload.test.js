const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sendBufferDownload,
  sendPathDownload,
} = require('@/modules/shared/http');

test('sendBufferDownload normalizes unsafe download filenames before writing headers', () => {
  const headers = {};
  const payload = Buffer.from('pdf');
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
    send(buffer) {
      headers.sentBuffer = buffer;
    },
  };

  sendBufferDownload(res, {
    contentType: 'application/pdf',
    fileName: '../cliente"\r\nX-Injected: yes.pdf',
    buffer: payload,
  });

  assert.equal(headers['Content-Type'], 'application/pdf');
  assert.match(headers['Content-Disposition'], /^attachment; filename="[^"\r\n\\/]+\.pdf"$/);
  assert.equal(headers.sentBuffer, payload);
});

test('sendPathDownload normalizes unsafe download filenames before delegating to Express', () => {
  const calls = [];
  const res = {
    download(absolutePath, fileName) {
      calls.push({ absolutePath, fileName });
    },
  };

  sendPathDownload(res, {
    absolutePath: '/tmp/customer-doc.pdf',
    fileName: '..\\soporte"\nSet-Cookie: x.pdf',
  });

  assert.deepEqual(calls, [{
    absolutePath: '/tmp/customer-doc.pdf',
    fileName: 'soporte__Set-Cookie: x.pdf',
  }]);
});
