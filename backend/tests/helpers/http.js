const http = require('node:http');

const listen = (app) => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const closeServer = (server) => new Promise((resolve, reject) => {
  if (!server) {
    resolve();
    return;
  }

  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

const requestJson = (server, { method = 'GET', path = '/', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const payload = body === undefined ? null : JSON.stringify(body);
  const { port } = server.address();

  const request = http.request({
    hostname: '127.0.0.1',
    port,
    method,
    path,
    headers: {
      ...(payload ? {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      } : {}),
      ...headers,
    },
  }, (response) => {
    let rawBody = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      rawBody += chunk;
    });
    response.on('end', () => {
      let parsedBody = null;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }
      resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: parsedBody,
      });
    });
  });

  request.on('error', reject);

  if (payload) {
    request.write(payload);
  }

  request.end();
});

module.exports = {
  listen,
  closeServer,
  requestJson,
};
