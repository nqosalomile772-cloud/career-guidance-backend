const admin = require('firebase-admin');
const { successResponse, errorResponse } = require('../utils/response');

const db = admin.firestore();
const auth = admin.auth();

// Register user
const register = async (req, res) => {
  const { email, password, role } = req.body;
  
  try {
    const userRecord = await auth.createUser({ email, password });
    await auth.setCustomUserClaims(userRecord.uid, { role });
    
    await db.collection('users').doc(userRecord.uid).set({ 
      email, 
      role, 
      profileData: {},
      createdAt: admin.firestore.Timestamp.now()
    });
    
    await auth.generateEmailVerificationLink(email);
    
    return successResponse(
      res,
      { uid: userRecord.uid },
      'User registered successfully. Please verify your email.',
      201
    );
  } catch (error) {
    return errorResponse(res, 'Registration failed', 400, error);
  }
};

// Login (verify token)
const login = async (req, res) => {
  const { idToken } = req.body;
  
  try {
    const decoded = await auth.verifyIdToken(idToken);
    
    if (!decoded.email_verified) {
      return errorResponse(res, 'Email not verified', 403);
    }
    
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    
    return successResponse(res, {
      uid: decoded.uid,
      role: decoded.role,
      profile: userDoc.data()?.profileData || {}
    });
  } catch (error) {
    return errorResponse(res, 'Login failed', 400, error);
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  const { uid } = req.user;
  
  try {
    await db.collection('users').doc(uid).update({ 
      profileData: req.body,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    return successResponse(res, null, 'Profile updated successfully');
  } catch (error) {
    return errorResponse(res, 'Error updating profile', 500, error);
  }
};

// Get user profile
const getProfile = async (req, res) => {
  const { uid } = req.user;
  
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return errorResponse(res, 'User not found', 404);
    }
    
    return successResponse(res, userDoc.data());
  } catch (error) {
    return errorResponse(res, 'Error fetching profile', 500, error);
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  const { oobCode } = req.body; // From the email link
  
  try {
    await auth.verifyEmailVerificationCode(oobCode);
    return successResponse(res, null, 'Email verified successfully');
  } catch (error) {
    return errorResponse(res, 'Email verification failed', 400, error);
  }
};

// Reset password
const resetPassword = async (req, res) => {
  const { email } = req.body;
  
  try {
    await auth.generatePasswordResetLink(email);
    return successResponse(res, null, 'Password reset link sent to email');
  } catch (error) {
    return errorResponse(res, 'Error sending password reset link', 400, error);
  }
};

module.exports = {
  register,
  login,
  updateProfile,
  getProfile,
  verifyEmail,
  resetPassword
};