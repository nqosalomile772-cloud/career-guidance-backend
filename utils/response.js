const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, error = null) => {
  const response = {
    success: false,
    message,
  };
  
  if (error && process.env.NODE_ENV !== 'production') {
    response.error = error.toString();
  }
  
  res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse
};