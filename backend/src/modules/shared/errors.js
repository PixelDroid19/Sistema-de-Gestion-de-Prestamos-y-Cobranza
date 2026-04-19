const { AppError } = require('@/utils/errorHandler');

const mapApplicationError = (error) => {
  if (error instanceof AppError) {
    return error;
  }

  return error;
};

module.exports = {
  mapApplicationError,
};
