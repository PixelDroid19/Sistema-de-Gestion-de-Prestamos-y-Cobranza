const runMiddleware = (middleware, req = {}) => new Promise((resolve, reject) => {
  const normalizedReq = {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...req,
  };

  middleware(normalizedReq, {}, (error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
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
