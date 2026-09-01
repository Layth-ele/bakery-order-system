const { validationResult } = require('express-validator');

function validate(request, response, next) {
  const result = validationResult(request);

  if (result.isEmpty()) {
    return next();
  }

  return response.status(400).json({
    error: 'Validation failed',
    details: result.array().map(({ msg, path, value }) => ({ msg, path, value })),
  });
}

module.exports = validate;
