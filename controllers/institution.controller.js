const admin = require('firebase-admin');
const { successResponse, errorResponse } = require('../utils/response');

const db = admin.firestore();

// Get all institutions
const getAllInstitutions = async (req, res) => {
  try {
    const snapshot = await db.collection('institutions').get();
    const institutions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return successResponse(res, institutions);
  } catch (error) {
    return errorResponse(res, 'Error fetching institutions', 500, error);
  }
};

// Get institution by ID
const getInstitution = async (req, res) => {
  const { id } = req.params;
  
  try {
    const doc = await db.collection('institutions').doc(id).get();
    
    if (!doc.exists) {
      return errorResponse(res, 'Institution not found', 404);
    }
    
    return successResponse(res, {
      id: doc.id,
      ...doc.data()
    });
  } catch (error) {
    return errorResponse(res, 'Error fetching institution', 500, error);
  }
};

// Create institution
const createInstitution = async (req, res) => {
  try {
    const docRef = await db.collection('institutions').add({
      ...req.body,
      createdAt: admin.firestore.Timestamp.now(),
      createdBy: req.user.uid
    });
    
    return successResponse(
      res, 
      { id: docRef.id },
      'Institution created successfully',
      201
    );
  } catch (error) {
    return errorResponse(res, 'Error creating institution', 500, error);
  }
};

// Update institution
const updateInstitution = async (req, res) => {
  const { id } = req.params;
  
  try {
    const doc = await db.collection('institutions').doc(id).get();
    
    if (!doc.exists) {
      return errorResponse(res, 'Institution not found', 404);
    }
    
    await db.collection('institutions').doc(id).update({
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: req.user.uid
    });
    
    return successResponse(res, null, 'Institution updated successfully');
  } catch (error) {
    return errorResponse(res, 'Error updating institution', 500, error);
  }
};

// Delete institution
const deleteInstitution = async (req, res) => {
  const { id } = req.params;
  
  try {
    const doc = await db.collection('institutions').doc(id).get();
    
    if (!doc.exists) {
      return errorResponse(res, 'Institution not found', 404);
    }
    
    await db.collection('institutions').doc(id).delete();
    
    return successResponse(res, null, 'Institution deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Error deleting institution', 500, error);
  }
};

// Add faculty to institution
const addFaculty = async (req, res) => {
  const { institutionId, faculty } = req.body;
  
  try {
    const doc = await db.collection('institutions').doc(institutionId).get();
    
    if (!doc.exists) {
      return errorResponse(res, 'Institution not found', 404);
    }
    
    await db.collection('institutions').doc(institutionId).update({
      faculties: admin.firestore.FieldValue.arrayUnion(faculty),
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: req.user.uid
    });
    
    return successResponse(res, null, 'Faculty added successfully');
  } catch (error) {
    return errorResponse(res, 'Error adding faculty', 500, error);
  }
};

// Add course to faculty
const addCourse = async (req, res) => {
  const { institutionId, facultyName, course } = req.body;
  
  try {
    const instRef = db.collection('institutions').doc(institutionId);
    const doc = await instRef.get();
    
    if (!doc.exists) {
      return errorResponse(res, 'Institution not found', 404);
    }
    
    const faculties = doc.data().faculties || [];
    const facultyIndex = faculties.findIndex(f => f.name === facultyName);
    
    if (facultyIndex === -1) {
      return errorResponse(res, 'Faculty not found', 404);
    }
    
    faculties[facultyIndex].courses = faculties[facultyIndex].courses || [];
    faculties[facultyIndex].courses.push({
      ...course,
      id: admin.firestore.Timestamp.now().toMillis().toString()
    });
    
    await instRef.update({ 
      faculties,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: req.user.uid
    });
    
    return successResponse(res, null, 'Course added successfully');
  } catch (error) {
    return errorResponse(res, 'Error adding course', 500, error);
  }
};

module.exports = {
  getAllInstitutions,
  getInstitution,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  addFaculty,
  addCourse
};