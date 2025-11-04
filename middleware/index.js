const admin = require('firebase-admin');
const { errorResponse } = require('../utils/response');

const checkRole = (roles) => async (req, res, next) => {
  const { authorization } = req.headers;
  
  if (!authorization) {
    return errorResponse(res, 'No token provided', 401);
  }

  try {
    const token = authorization.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    
    if (roles.includes(decoded.role)) {
      // Attach user info to request for later use
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        role: decoded.role,
        emailVerified: decoded.email_verified
      };
      next();
    } else {
      return errorResponse(res, 'Unauthorized role', 403);
    }
  } catch (error) {
    return errorResponse(res, 'Invalid token', 401, error);
  }
};

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  
  if (error) {
    return errorResponse(res, 'Validation error', 400, error.details[0].message);
  }
  
  next();
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    return errorResponse(res, error.message, error.statusCode || 500, error);
  });
};

module.exports = {
  checkRole,
  validateRequest,
  asyncHandler
};