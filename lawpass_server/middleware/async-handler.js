"use strict";

/**
 * Wraps an async route handler so a rejected promise is forwarded to the
 * Express error handler instead of hanging the request.
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
