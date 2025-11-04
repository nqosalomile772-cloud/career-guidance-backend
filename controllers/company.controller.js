const admin = require('firebase-admin');
const { successResponse, errorResponse } = require('../utils/response');

const db = admin.firestore();

// Post a job
const postJob = async (req, res) => {
  const companyId = req.user.uid;
  
  try {
    // First get company profile
    const companyDoc = await db.collection('users').doc(companyId).get();
    if (!companyDoc.exists) {
      return errorResponse(res, 'Company profile not found', 404);
    }
    
    const jobData = {
      ...req.body,
      companyId,
      companyName: companyDoc.data().profileData.name || 'Unknown Company',
      status: 'active',
      postedDate: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const docRef = await db.collection('jobs').add(jobData);
    
    return successResponse(
      res,
      { id: docRef.id },
      'Job posted successfully',
      201
    );
  } catch (error) {
    return errorResponse(res, 'Error posting job', 500, error);
  }
};

// Get company's jobs
const getCompanyJobs = async (req, res) => {
  const companyId = req.user.uid;
  
  try {
    const snapshot = await db.collection('jobs')
      .where('companyId', '==', companyId)
      .orderBy('postedDate', 'desc')
      .get();
    
    const jobs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return successResponse(res, jobs);
  } catch (error) {
    return errorResponse(res, 'Error fetching jobs', 500, error);
  }
};

// Update job
const updateJob = async (req, res) => {
  const { jobId } = req.params;
  const companyId = req.user.uid;
  
  try {
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    
    if (!jobDoc.exists) {
      return errorResponse(res, 'Job not found', 404);
    }
    
    if (jobDoc.data().companyId !== companyId) {
      return errorResponse(res, 'Not authorized to update this job', 403);
    }
    
    await db.collection('jobs').doc(jobId).update({
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now()
    });
    
    return successResponse(res, null, 'Job updated successfully');
  } catch (error) {
    return errorResponse(res, 'Error updating job', 500, error);
  }
};

// Delete job
const deleteJob = async (req, res) => {
  const { jobId } = req.params;
  const companyId = req.user.uid;
  
  try {
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    
    if (!jobDoc.exists) {
      return errorResponse(res, 'Job not found', 404);
    }
    
    if (jobDoc.data().companyId !== companyId) {
      return errorResponse(res, 'Not authorized to delete this job', 403);
    }
    
    await db.collection('jobs').doc(jobId).delete();
    
    return successResponse(res, null, 'Job deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Error deleting job', 500, error);
  }
};

// Get qualified applicants for a job
const getQualifiedApplicants = async (req, res) => {
  const { jobId } = req.params;
  const companyId = req.user.uid;
  
  try {
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    
    if (!jobDoc.exists) {
      return errorResponse(res, 'Job not found', 404);
    }
    
    if (jobDoc.data().companyId !== companyId) {
      return errorResponse(res, 'Not authorized to view this job\'s applicants', 403);
    }
    
    const job = jobDoc.data();
    const transcriptsSnapshot = await db.collection('transcripts').get();
    const qualified = [];
    
    for (const doc of transcriptsSnapshot.docs) {
      const applicant = doc.data();
      let matches = true;
      
      // Check GPA requirement
      if (job.requirements.minGPA && applicant.gpa < job.requirements.minGPA) {
        matches = false;
      }
      
      // Check experience requirement
      const totalExperience = applicant.workExperience.reduce((total, exp) => total + exp.years, 0);
      if (job.requirements.experienceYears && totalExperience < job.requirements.experienceYears) {
        matches = false;
      }
      
      // Check certificates requirement
      if (job.requirements.certificates && 
          !job.requirements.certificates.every(cert => 
            applicant.certificates.some(studCert => 
              studCert.name.toLowerCase() === cert.toLowerCase()
            )
          )) {
        matches = false;
      }
      
      if (matches) {
        // Get applicant profile
        const userDoc = await db.collection('users').doc(applicant.studentId).get();
        qualified.push({
          studentId: applicant.studentId,
          profile: userDoc.data()?.profileData || {},
          transcript: applicant,
          matchScore: calculateMatchScore(applicant, job)
        });
      }
    }
    
    // Sort by match score
    qualified.sort((a, b) => b.matchScore - a.matchScore);
    
    return successResponse(res, qualified);
  } catch (error) {
    return errorResponse(res, 'Error fetching qualified applicants', 500, error);
  }
};

// Helper function to calculate applicant match score
const calculateMatchScore = (applicant, job) => {
  let score = 0;
  
  // GPA score (40%)
  if (job.requirements.minGPA) {
    score += (applicant.gpa / job.requirements.minGPA) * 40;
  } else {
    score += 40;
  }
  
  // Experience score (30%)
  const totalExperience = applicant.workExperience.reduce((total, exp) => total + exp.years, 0);
  if (job.requirements.experienceYears) {
    score += (totalExperience / job.requirements.experienceYears) * 30;
  } else {
    score += totalExperience > 0 ? 30 : 15;
  }
  
  // Certificates score (30%)
  if (job.requirements.certificates && job.requirements.certificates.length > 0) {
    const matchingCerts = job.requirements.certificates.filter(cert =>
      applicant.certificates.some(studCert => 
        studCert.name.toLowerCase() === cert.toLowerCase()
      )
    ).length;
    score += (matchingCerts / job.requirements.certificates.length) * 30;
  } else {
    score += 30;
  }
  
  return Math.min(100, score);
};

module.exports = {
  postJob,
  getCompanyJobs,
  updateJob,
  deleteJob,
  getQualifiedApplicants
};