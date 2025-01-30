// middlewares/errorHandler.js
const CustomError = require('../utils/customError');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };

  // Handle MongoDB validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new CustomError(message, 400);
  }

  // Handle MongoDB duplicate key errors (unique constraint violation)
  if (err.code === 11000) {
    const message = `Duplicate field value entered. ${Object.keys(err.keyValue)} field must be unique.`;
    error = new CustomError(message, 400);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new CustomError('Invalid token', 401);
  }

  // Handle expired token errors
  if (err.name === 'TokenExpiredError') {
    error = new CustomError('Token expired', 401);
  }

  // Handle any other errors
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
