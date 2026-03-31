const runMiddleware = (middleware, req = {}) => new Promise((resolve, reject) => {
  const normalizedReq = {
    body: req.body || {},
    params: req.params || {},
    query: req.query || {},
    headers: req.headers || {},
    ...req,
  };

  middleware(normalizedReq, {}, (error) => {
    if (error) {
      reject(error);
      return;
    }

    // Copy all properties from normalizedReq back to req so assertions on req work
    Object.assign(req, normalizedReq);
    resolve(req);
  });
});

const captureMiddlewareError = (middleware, req = {}) => new Promise((resolve) => {
  const normalizedReq = {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...req,
  };

  middleware(normalizedReq, {}, (error) => {
    resolve(error || null);
  });
});

module.exports = {
  runMiddleware,
  captureMiddlewareError,
};
