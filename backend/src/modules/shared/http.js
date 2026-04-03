/**
 * Send a JSON response with the provided status code.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {object} payload
 */
const respond = (res, statusCode, payload) => res.status(statusCode).json(payload);

/**
 * Send the standard success payload shape used across backend routers.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message]
 * @param {number} [statusCode=200]
 * @param {object} [extra={}]
 */
const success = (res, data, message, statusCode = 200, extra = {}) => respond(res, statusCode, {
  success: true,
  ...(message ? { message } : {}),
  ...extra,
  data,
});

/**
 * Send the standard created payload shape used for resource creation routes.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {string} [message='Created successfully']
 * @param {object} [extra={}]
 */
const created = (res, data, message = 'Created successfully', extra = {}) => success(res, data, message, 201, extra);

/**
 * Send a buffer as a file download response.
 * @param {import('express').Response} res
 * @param {{ contentType: string, fileName: string, buffer: Buffer }} file
 */
const sendBufferDownload = (res, { contentType, fileName, buffer }) => {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
};

/**
 * Send a filesystem path as a file download response.
 * @param {import('express').Response} res
 * @param {{ absolutePath: string, fileName: string }} file
 */
const sendPathDownload = (res, { absolutePath, fileName }) => res.download(absolutePath, fileName);

module.exports = {
  respond,
  success,
  created,
  sendBufferDownload,
  sendPathDownload,
};
