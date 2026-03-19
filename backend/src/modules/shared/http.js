const respond = (res, statusCode, payload) => res.status(statusCode).json(payload);

const success = (res, data, message, statusCode = 200, extra = {}) => respond(res, statusCode, {
  success: true,
  ...(message ? { message } : {}),
  ...extra,
  data,
});

const created = (res, data, message = 'Created successfully', extra = {}) => success(res, data, message, 201, extra);

module.exports = {
  respond,
  success,
  created,
};
