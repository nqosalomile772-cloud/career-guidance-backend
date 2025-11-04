const admin = require('firebase-admin');
const { successResponse, errorResponse } = require('../utils/response');

const db = admin.firestore();

// Apply to institution
const apply = async (req, res) => {
  const { institutionId, courseId } = req.body;
  const studentId = req.user.uid;
  
  try {
    // Check max 2 applications per institution
    const existingApps = await db.collection('applications')
      .where('studentId', '==', studentId)
      .where('institutionId', '==', institutionId)
      .get();
    
    if (existingApps.docs.length >= 2) {
      return errorResponse(res, 'Maximum 2 applications per institution allowed', 400);
    }
    
    // Check if already admitted elsewhere
    const admittedCheck = await db.collection('applications')
      .where('studentId', '==', studentId)
      .where('status', '==', 'admitted')
      .get();

    if (!admittedCheck.empty) {
      return errorResponse(res, 'You have already been admitted to another institution', 400);
    }
    
    // Check institution and course exist
    const inst = await db.collection('institutions').doc(institutionId).get();
    if (!inst.exists) {
      return errorResponse(res, 'Institution not found', 404);
    }
    
    const course = inst.data().faculties
      .flatMap(f => f.courses || [])
      .find(c => c.id === courseId);
    
    if (!course) {
      return errorResponse(res, 'Course not found', 404);
    }
    
    // Check qualifications
    const transcript = await db.collection('transcripts')
      .where('studentId', '==', studentId)
      .get();
    
    if (transcript.empty) {
      return errorResponse(res, 'Please upload your transcript first', 400);
    }
    
    const studentData = transcript.docs[0].data();
    
    if (studentData.gpa < course.requirements.minGPA) {
      return errorResponse(res, 'Does not meet GPA requirement', 400);
    }
    
    // Create application
    const docRef = await db.collection('applications').add({
      studentId,
      institutionId,
      courseId,
      status: 'pending',
      appliedDate: admin.firestore.Timestamp.now(),
      docs: req.body.docs || [],
      studentGPA: studentData.gpa,
      courseName: course.name,
      institutionName: inst.data().name
    });
    
    return successResponse(
      res, 
      { id: docRef.id },
      'Application submitted successfully',
      201
    );
  } catch (error) {
    return errorResponse(res, 'Error submitting application', 500, error);
  }
};

// Get student applications
const getApplications = async (req, res) => {
  const studentId = req.user.uid;
  
  try {
    const snapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .get();
    
    const applications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return successResponse(res, applications);
  } catch (error) {
    return errorResponse(res, 'Error fetching applications', 500, error);
  }
};

// Get student admissions
const getAdmissions = async (req, res) => {
  const studentId = req.user.uid;
  
  try {
    const apps = await db.collection('applications')
      .where('studentId', '==', studentId)
      .where('status', '==', 'admitted')
      .get();
    
    const admissions = apps.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return successResponse(res, admissions);
  } catch (error) {
    return errorResponse(res, 'Error fetching admissions', 500, error);
  }
};

// Select admission
const selectAdmission = async (req, res) => {
  const { selectedInstitutionId } = req.body;
  const studentId = req.user.uid;
  
  try {
    const batch = db.batch();
    
    // Find all admissions for student
    const admSnapshots = await db.collection('admissions')
      .where('admittedStudents', 'array-contains', studentId)
      .get();
    
    // Update selected application status
    const selectedAppSnapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .where('institutionId', '==', selectedInstitutionId)
      .get();
      
    selectedAppSnapshot.docs.forEach(appDoc => {
      batch.update(appDoc.ref, {
        status: 'accepted',
        updatedAt: admin.firestore.Timestamp.now()
      });
    });
    
    for (const admDoc of admSnapshots.docs) {
      const admData = admDoc.data();
      
      if (admData.institutionId !== selectedInstitutionId) {
        // Get the next student from waiting list
        const nextStudent = admData.waitingList && admData.waitingList.length > 0 
          ? admData.waitingList[0] 
          : null;
        
        // Update admissions document
        const updates = {
          admittedStudents: admin.firestore.FieldValue.arrayRemove(studentId),
          updatedAt: admin.firestore.Timestamp.now()
        };
        
        if (nextStudent) {
          updates.admittedStudents = admin.firestore.FieldValue.arrayUnion(nextStudent);
          updates.waitingList = admin.firestore.FieldValue.arrayRemove(nextStudent);
          
          // Update promoted student's application
          const promotedAppSnapshot = await db.collection('applications')
            .where('studentId', '==', nextStudent)
            .where('institutionId', '==', admData.institutionId)
            .get();
          
          promotedAppSnapshot.docs.forEach(appDoc => {
            batch.update(appDoc.ref, {
              status: 'admitted',
              updatedAt: admin.firestore.Timestamp.now()
            });
          });
        }
        
        batch.update(admDoc.ref, updates);
        
        // Update current student's rejected application
        const rejectedAppSnapshot = await db.collection('applications')
          .where('studentId', '==', studentId)
          .where('institutionId', '==', admData.institutionId)
          .get();
        
        rejectedAppSnapshot.docs.forEach(appDoc => {
          batch.update(appDoc.ref, { 
            status: 'rejected',
            updatedAt: admin.firestore.Timestamp.now()
          });
        });
      }
    }
    
    await batch.commit();
    
    return successResponse(res, null, 'Admission selected successfully');
  } catch (error) {
    return errorResponse(res, 'Error selecting admission', 500, error);
  }
};

// Upload transcript
const uploadTranscript = async (req, res) => {
  const { gpa, certificates, workExperience } = req.body;
  const studentId = req.user.uid;
  
  try {
    await db.collection('transcripts').doc(studentId).set({
      studentId,
      gpa,
      certificates: certificates || [],
      workExperience: workExperience || [],
      uploadDate: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    }, { merge: true });
    
    return successResponse(res, null, 'Transcript uploaded successfully');
  } catch (error) {
    return errorResponse(res, 'Error uploading transcript', 500, error);
  }
};

// Get matching jobs
const getMatchingJobs = async (req, res) => {
  const studentId = req.user.uid;
  
  try {
    const transcript = await db.collection('transcripts').doc(studentId).get();
    
    if (!transcript.exists) {
      return errorResponse(res, 'Please upload your transcript first', 404);
    }
    
    const studentData = transcript.data();
    const jobsSnapshot = await db.collection('jobs').get();
    const matchingJobs = [];
    
    jobsSnapshot.docs.forEach(doc => {
      const job = doc.data();
      let matches = true;
      
      // Check GPA requirement
      if (job.requirements.minGPA && studentData.gpa < job.requirements.minGPA) {
        matches = false;
      }
      
      // Check experience requirement
      const totalExperience = studentData.workExperience.reduce((total, exp) => total + exp.years, 0);
      if (job.requirements.experienceYears && totalExperience < job.requirements.experienceYears) {
        matches = false;
      }
      
      // Check certificates requirement
      if (job.requirements.certificates && 
          !job.requirements.certificates.every(cert => 
            studentData.certificates.some(studCert => 
              studCert.name.toLowerCase() === cert.toLowerCase()
            )
          )) {
        matches = false;
      }
      
      if (matches) {
        matchingJobs.push({
          id: doc.id,
          ...job,
          matchScore: calculateMatchScore(studentData, job)
        });
      }
    });
    
    // Sort by match score
    matchingJobs.sort((a, b) => b.matchScore - a.matchScore);
    
    return successResponse(res, matchingJobs);
  } catch (error) {
    return errorResponse(res, 'Error fetching matching jobs', 500, error);
  }
};

// Helper function to calculate job match score
const calculateMatchScore = (student, job) => {
  let score = 0;
  
  // GPA score (40%)
  if (job.requirements.minGPA) {
    score += (student.gpa / job.requirements.minGPA) * 40;
  } else {
    score += 40;
  }
  
  // Experience score (30%)
  const totalExperience = student.workExperience.reduce((total, exp) => total + exp.years, 0);
  if (job.requirements.experienceYears) {
    score += (totalExperience / job.requirements.experienceYears) * 30;
  } else {
    score += totalExperience > 0 ? 30 : 15;
  }
  
  // Certificates score (30%)
  if (job.requirements.certificates && job.requirements.certificates.length > 0) {
    const matchingCerts = job.requirements.certificates.filter(cert =>
      student.certificates.some(studCert => 
        studCert.name.toLowerCase() === cert.toLowerCase()
      )
    ).length;
    score += (matchingCerts / job.requirements.certificates.length) * 30;
  } else {
    score += 30;
  }
  
  return Math.min(100, score);
};

// Check waiting list position
const checkWaitingListPosition = async (req, res) => {
  const studentId = req.user.uid;
  const { institutionId } = req.params;
  
  try {
    const admissionDoc = await db.collection('admissions')
      .where('institutionId', '==', institutionId)
      .where('waitingList', 'array-contains', studentId)
      .get();
    
    if (admissionDoc.empty) {
      return errorResponse(res, 'Not found in waiting list', 404);
    }
    
    const admissionData = admissionDoc.docs[0].data();
    const position = admissionData.waitingList.indexOf(studentId) + 1;
    
    return successResponse(res, {
      position,
      totalWaiting: admissionData.waitingList.length,
      institutionName: admissionData.institutionName,
      courseName: admissionData.courseName
    });
  } catch (error) {
    return errorResponse(res, 'Error checking waiting list position', 500, error);
  }
};

module.exports = {
  apply,
  getApplications,
  getAdmissions,
  selectAdmission,
  uploadTranscript,
  getMatchingJobs,
  checkWaitingListPosition
};