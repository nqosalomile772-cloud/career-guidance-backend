require('dotenv').config();
const { app } = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`�️  DB test: http://localhost:${PORT}/test-db`);
  console.log('⏹️  Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// Catch unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Promise Rejection:', error);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

console.log('🔄 Starting server initialization...');

// Initialize Firebase Admin with error handling
try {
  console.log('📁 Loading service account key...');
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('🎉 Backend is running! Career Guidance System API is working!');
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    firebase: 'Connected'
  });
});

// Test Firestore connection
app.get('/test-db', async (req, res) => {
  try {
    const testRef = db.collection('test');
    const snapshot = await testRef.get();
    res.json({ 
      success: true, 
      message: 'Firestore connected successfully!', 
      data: snapshot.docs.map(doc => doc.data()) 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Firestore connection failed: ' + error.message 
    });
  }
});

// Middleware for role checks
const checkRole = (roles) => async (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) return res.status(401).send('No token provided');
  try {
    const token = authorization.split(' ')[1];
    const decoded = await auth.verifyIdToken(token);
    if (roles.includes(decoded.role)) {
      req.user = decoded; // Attach user to req for later use
      next();
    } else {
      res.status(403).send('Unauthorized role');
    }
  } catch (error) {
    res.status(401).send('Invalid token: ' + error.message);
  }
};

// Auth APIs

// Register user with role
app.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).send('Missing fields');
  try {
    const userRecord = await auth.createUser({ email, password });
    await auth.setCustomUserClaims(userRecord.uid, { role });
    await db.collection('users').doc(userRecord.uid).set({ email, role, profileData: {} });
    const user = await auth.getUser(userRecord.uid);
    await auth.generateEmailVerificationLink(user.email); // Note: This sends via your setup; alternatively use client-side
    res.send({ message: 'User registered. Please verify email.', uid: userRecord.uid });
  } catch (error) {
    res.status(400).send('Registration failed: ' + error.message);
  }
});

// Login (verify token)
app.post('/login', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).send('Missing idToken');
  try {
    const decoded = await auth.verifyIdToken(idToken);
    if (!decoded.email_verified) return res.status(403).send('Email not verified');
    res.send({ uid: decoded.uid, role: decoded.role });
  } catch (error) {
    res.status(400).send('Login failed: ' + error.message);
  }
});

// Admin Module APIs
app.post('/admin/institutions', checkRole(['admin']), async (req, res) => {
  try {
    const docRef = await db.collection('institutions').add(req.body);
    res.send({ id: docRef.id, message: 'Institution added' });
  } catch (error) {
    res.status(500).send('Error adding institution: ' + error.message);
  }
});

app.put('/admin/institutions/:id', checkRole(['admin']), async (req, res) => {
  try {
    await db.collection('institutions').doc(req.params.id).update(req.body);
    res.send({ message: 'Institution updated' });
  } catch (error) {
    res.status(500).send('Error updating institution: ' + error.message);
  }
});

app.delete('/admin/institutions/:id', checkRole(['admin']), async (req, res) => {
  try {
    await db.collection('institutions').doc(req.params.id).delete();
    res.send({ message: 'Institution deleted' });
  } catch (error) {
    res.status(500).send('Error deleting institution: ' + error.message);
  }
});

app.get('/admin/reports', checkRole(['admin']), async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Add more reports as needed, e.g., applications count
    res.send({ users });
  } catch (error) {
    res.status(500).send('Error generating reports: ' + error.message);
  }
});

// Add more admin APIs like manage companies
app.post('/admin/companies/approve/:uid', checkRole(['admin']), async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).update({ status: 'approved' });
    res.send({ message: 'Company approved' });
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

// Institute Module APIs
app.post('/institute/faculties', checkRole(['institute']), async (req, res) => {
  const { institutionId, faculty } = req.body;
  if (!institutionId || !faculty) return res.status(400).send('Missing fields');
  try {
    await db.collection('institutions').doc(institutionId).update({
      faculties: admin.firestore.FieldValue.arrayUnion(faculty)
    });
    res.send({ message: 'Faculty added' });
  } catch (error) {
    res.status(500).send('Error adding faculty: ' + error.message);
  }
});

app.post('/institute/courses', checkRole(['institute']), async (req, res) => {
  const { institutionId, facultyName, course } = req.body;
  try {
    const instRef = db.collection('institutions').doc(institutionId);
    const inst = await instRef.get();
    if (!inst.exists) return res.status(404).send('Institution not found');
    const faculties = inst.data().faculties || [];
    const facultyIndex = faculties.findIndex(f => f.name === facultyName);
    if (facultyIndex === -1) return res.status(404).send('Faculty not found');
    faculties[facultyIndex].courses = faculties[facultyIndex].courses || [];
    faculties[facultyIndex].courses.push(course);
    await instRef.update({ faculties });
    res.send({ message: 'Course added' });
  } catch (error) {
    res.status(500).send('Error adding course: ' + error.message);
  }
});

app.get('/institute/applications', checkRole(['institute']), async (req, res) => {
  try {
    const institutionId = req.user.institutionId; // Assume stored in custom claims or fetch from users
    const snapshot = await db.collection('applications').where('institutionId', '==', institutionId).get();
    const applications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.send(applications);
  } catch (error) {
    res.status(500).send('Error fetching applications: ' + error.message);
  }
});

// Add publish admissions, manage status, etc.
app.post('/institute/admissions/publish', checkRole(['institute']), async (req, res) => {
  const { institutionId, courseId, admittedStudents, waitingList } = req.body;
  try {
    await db.collection('admissions').add({ institutionId, courseId, admittedStudents, waitingList, published: true });
    // Update applications statuses
    for (const studentId of admittedStudents) {
      await db.collection('applications').where('studentId', '==', studentId).where('institutionId', '==', institutionId).update({ status: 'admitted' });
    }
    res.send({ message: 'Admissions published' });
  } catch (error) {
    res.status(500).send('Error publishing admissions: ' + error.message);
  }
});

// Student Module APIs
app.post('/student/apply', checkRole(['student']), async (req, res) => {
  const { institutionId, courseId } = req.body;
  const studentId = req.user.uid;
  try {
    // Check max 2 applications per institution
    const existingApps = await db.collection('applications').where('studentId', '==', studentId).where('institutionId', '==', institutionId).get();
    if (existingApps.docs.length >= 2) return res.status(400).send('Max 2 applications per institution');

    // Check qualifications
    const inst = await db.collection('institutions').doc(institutionId).get();
    if (!inst.exists) return res.status(404).send('Institution not found');
    const course = inst.data().faculties.flatMap(f => f.courses || []).find(c => c.name === courseId); // Adjust if courseId is ID
    if (!course) return res.status(404).send('Course not found');

    const transcript = await db.collection('transcripts').where('studentId', '==', studentId).get();
    const studentData = transcript.docs[0]?.data() || {};
    if (studentData.gpa < course.requirements.minGPA) return res.status(400).send('Does not meet GPA requirement');

    // Check not admitted to multiple (but this is post-admission)
    // Add application
    const docRef = await db.collection('applications').add({
      studentId,
      institutionId,
      courseId,
      status: 'pending',
      appliedDate: admin.firestore.Timestamp.now(),
      docs: req.body.docs || []
    });
    res.send({ id: docRef.id, message: 'Application submitted' });
  } catch (error) {
    res.status(500).send('Error applying: ' + error.message);
  }
});

app.get('/student/admissions', checkRole(['student']), async (req, res) => {
  const studentId = req.user.uid;
  try {
    const apps = await db.collection('applications').where('studentId', '==', studentId).where('status', '==', 'admitted').get();
    const admissions = apps.docs.map(doc => doc.data());
    res.send(admissions);
  } catch (error) {
    res.status(500).send('Error fetching admissions: ' + error.message);
  }
});

app.post('/student/select-admission', checkRole(['student']), async (req, res) => {
  const { selectedInstitutionId } = req.body;
  const studentId = req.user.uid;
  try {
    // Find all admissions for student
    const admSnapshots = await db.collection('admissions').where('admittedStudents', 'array-contains', studentId).get();
    for (const admDoc of admSnapshots.docs) {
      const admData = admDoc.data();
      if (admData.institutionId !== selectedInstitutionId) {
        // Remove from admitted, promote waiting list
        await admDoc.ref.update({
          admittedStudents: admin.firestore.FieldValue.arrayRemove(studentId),
          admittedStudents: admin.firestore.FieldValue.arrayUnion(admData.waitingList[0] || ''),
          waitingList: admin.firestore.FieldValue.arrayRemove(admData.waitingList[0] || '')
        });
        // Update application status
        await db.collection('applications').where('studentId', '==', studentId).where('institutionId', '==', admData.institutionId).update({ status: 'rejected' });
      }
    }
    res.send({ message: 'Admission selected' });
  } catch (error) {
    res.status(500).send('Error selecting admission: ' + error.message);
  }
});

app.post('/student/upload-transcript', checkRole(['student']), async (req, res) => {
  const { gpa, certificates, workExperience } = req.body;
  const studentId = req.user.uid;
  try {
    await db.collection('transcripts').doc(studentId).set({
      studentId,
      gpa,
      certificates: certificates || [],
      workExperience: workExperience || [],
      uploadDate: admin.firestore.Timestamp.now()
    }, { merge: true });
    res.send({ message: 'Transcript uploaded' });
  } catch (error) {
    res.status(500).send('Error uploading transcript: ' + error.message);
  }
});

app.get('/student/jobs', checkRole(['student']), async (req, res) => {
  const studentId = req.user.uid;
  try {
    const transcript = await db.collection('transcripts').doc(studentId).get();
    if (!transcript.exists) return res.status(404).send('Upload transcript first');
    const studentData = transcript.data();

    const jobsSnapshot = await db.collection('jobs').get();
    const matchingJobs = [];
    jobsSnapshot.docs.forEach(doc => {
      const job = doc.data();
      let matches = true;
      if (job.requirements.minGPA && studentData.gpa < job.requirements.minGPA) matches = false;
      if (job.requirements.experienceYears && (studentData.workExperience.reduce((total, exp) => total + exp.years, 0) < job.requirements.experienceYears)) matches = false;
      // Add cert checks: if (job.requirements.certificates && !job.requirements.certificates.every(c => studentData.certificates.includes(c))) matches = false;
      if (matches) matchingJobs.push({ id: doc.id, ...job });
    });
    res.send(matchingJobs);
  } catch (error) {
    res.status(500).send('Error fetching jobs: ' + error.message);
  }
});

// Company Module APIs
app.post('/company/jobs', checkRole(['company']), async (req, res) => {
  const companyId = req.user.uid;
  try {
    const docRef = await db.collection('jobs').add({ ...req.body, companyId, postedDate: admin.firestore.Timestamp.now() });
    res.send({ id: docRef.id, message: 'Job posted' });
  } catch (error) {
    res.status(500).send('Error posting job: ' + error.message);
  }
});

app.get('/company/applicants/:jobId', checkRole(['company']), async (req, res) => {
  try {
    const jobDoc = await db.collection('jobs').doc(req.params.jobId).get();
    if (!jobDoc.exists) return res.status(404).send('Job not found');
    const job = jobDoc.data();
    if (job.companyId !== req.user.uid) return res.status(403).send('Not your job');

    const transcriptsSnapshot = await db.collection('transcripts').get();
    const qualified = [];
    transcriptsSnapshot.docs.forEach(doc => {
      const applicant = doc.data();
      let matches = true;
      if (job.requirements.minGPA && applicant.gpa < job.requirements.minGPA) matches = false;
      if (job.requirements.experienceYears && (applicant.workExperience.reduce((total, exp) => total + exp.years, 0) < job.requirements.experienceYears)) matches = false;
      // Similar cert/relevance checks
      if (matches) qualified.push({ studentId: applicant.studentId, ...applicant });
    });
    res.send(qualified);
  } catch (error) {
    res.status(500).send('Error fetching applicants: ' + error.message);
  }
});

// Add more as needed, e.g., update profile for all roles
app.put('/profile', checkRole(['admin', 'institute', 'student', 'company']), async (req, res) => {
  const uid = req.user.uid;
  try {
    await db.collection('users').doc(uid).update({ profileData: req.body });
    res.send({ message: 'Profile updated' });
  } catch (error) {
    res.status(500).send('Error updating profile: ' + error.message);
  }
});

const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`🗄️  DB test: http://localhost:${PORT}/test-db`);
  console.log('⏹️  Press Ctrl+C to stop the server');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});