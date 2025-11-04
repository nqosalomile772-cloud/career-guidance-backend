const admin = require('firebase-admin');
const { db } = require('../app');

// Send notification to qualified students for a job
async function notifyQualifiedStudents(job) {
    try {
        // Get all student transcripts
        const transcriptsSnapshot = await db.collection('transcripts').get();
        
        for (const doc of transcriptsSnapshot.docs) {
            const student = doc.data();
            
            // Check if student meets job requirements
            if (isQualifiedForJob(student, job)) {
                // Create notification
                await db.collection('notifications').add({
                    userId: student.studentId,
                    type: 'JOB_MATCH',
                    jobId: job.id,
                    jobTitle: job.title,
                    companyName: job.companyName,
                    createdAt: admin.firestore.Timestamp.now(),
                    read: false,
                    message: `New job matching your profile: ${job.title} at ${job.companyName}`
                });
            }
        }
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

// Check if student is qualified for job
function isQualifiedForJob(student, job) {
    // GPA check
    if (job.requirements.minGPA && student.gpa < job.requirements.minGPA) {
        return false;
    }

    // Experience check
    const totalExperience = student.workExperience.reduce((total, exp) => total + exp.years, 0);
    if (job.requirements.experienceYears && totalExperience < job.requirements.experienceYears) {
        return false;
    }

    // Certificates check
    if (job.requirements.certificates && job.requirements.certificates.length > 0) {
        const hasCertificates = job.requirements.certificates.every(cert =>
            student.certificates.some(studCert => 
                studCert.name.toLowerCase() === cert.toLowerCase()
            )
        );
        if (!hasCertificates) return false;
    }

    // Relevance check based on student's field of study
    if (job.requirements.relevantFields && job.requirements.relevantFields.length > 0) {
        const isRelevantField = job.requirements.relevantFields.some(field =>
            student.fieldOfStudy && student.fieldOfStudy.toLowerCase().includes(field.toLowerCase())
        );
        if (!isRelevantField) return false;
    }

    return true;
}

// Calculate match score for job applications
function calculateMatchScore(student, job) {
    let score = 0;
    let total = 0;

    // GPA Score (30%)
    if (job.requirements.minGPA) {
        total += 30;
        score += (student.gpa / job.requirements.minGPA) * 30;
    }

    // Experience Score (30%)
    if (job.requirements.experienceYears) {
        total += 30;
        const totalExperience = student.workExperience.reduce((total, exp) => total + exp.years, 0);
        score += (totalExperience / job.requirements.experienceYears) * 30;
    }

    // Certificates Score (20%)
    if (job.requirements.certificates && job.requirements.certificates.length > 0) {
        total += 20;
        const matchingCerts = job.requirements.certificates.filter(cert =>
            student.certificates.some(studCert => 
                studCert.name.toLowerCase() === cert.toLowerCase()
            )
        ).length;
        score += (matchingCerts / job.requirements.certificates.length) * 20;
    }

    // Field Relevance Score (20%)
    if (job.requirements.relevantFields && job.requirements.relevantFields.length > 0) {
        total += 20;
        const isRelevantField = job.requirements.relevantFields.some(field =>
            student.fieldOfStudy && student.fieldOfStudy.toLowerCase().includes(field.toLowerCase())
        );
        if (isRelevantField) score += 20;
    }

    // Normalize score if not all criteria were present
    return total > 0 ? (score / total) * 100 : 0;
}

module.exports = {
    notifyQualifiedStudents,
    isQualifiedForJob,
    calculateMatchScore
};