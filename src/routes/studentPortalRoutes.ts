import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Middleware
import { authenticateStudent, verifyPaymentStatus } from '../middleware/studentAuth';

// Controllers
import * as studentAuthController from '../controllers/studentAuthController';
import * as paymentController from '../controllers/paymentController';
import * as courseRegistrationController from '../controllers/courseRegistrationController';
import * as resultsController from '../controllers/resultsController';
import * as assignmentController from '../controllers/assignmentController';
import * as dashboardController from '../controllers/dashboardController';
import * as studentDashboardController from '../controllers/studentDashboardController';
import * as documentsController from '../controllers/documentsController';
import * as profileController from '../controllers/profileController';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir = 'uploads/';
    
    if (file.fieldname === 'assignment') {
      uploadDir += 'assignments/';
    } else if (file.fieldname === 'profilePicture') {
      uploadDir += 'profiles/';
    } else {
      uploadDir += 'others/';
    }

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  // Assignment uploads: PDF, DOC, DOCX, ZIP
  if (file.fieldname === 'assignment') {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for assignment. Only PDF, DOC, DOCX, and ZIP files are allowed.'), false);
    }
  }
  // Profile picture uploads: JPG, JPEG, PNG
  else if (file.fieldname === 'profilePicture') {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type for profile picture. Only JPG, JPEG, and PNG files are allowed.'), false);
    }
  }
  else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// ============================
// PUBLIC ROUTES (No authentication required)
// ============================

// Authentication
router.post('/auth/login', studentAuthController.login);
router.post('/auth/register', studentAuthController.register);
router.post('/auth/refresh-token', studentAuthController.refreshToken);
router.post('/auth/forgot-password', studentAuthController.forgotPassword);
router.post('/auth/reset-password', studentAuthController.resetPassword);

// ============================
// PROTECTED ROUTES (Authentication required)
// ============================

// Authentication (protected)
router.post('/auth/logout', authenticateStudent, studentAuthController.logout);
router.post('/auth/change-password', authenticateStudent, studentAuthController.changePassword);
router.get('/auth/profile', authenticateStudent, studentAuthController.getProfile);

// Dashboard
router.get('/dashboard', authenticateStudent, studentDashboardController.getOverview);
router.get('/dashboard/stats', authenticateStudent, dashboardController.getDashboardStats);
router.get('/dashboard/activities', authenticateStudent, studentDashboardController.getActivities);
router.get('/dashboard/alerts', authenticateStudent, studentDashboardController.getAlerts);
router.get('/dashboard/events', authenticateStudent, dashboardController.getUpcomingEvents);

// Notifications
router.get('/notifications', authenticateStudent, studentDashboardController.getNotifications);
router.patch('/notifications/:id/read', authenticateStudent, studentDashboardController.markNotificationRead);
router.patch('/notifications/read-all', authenticateStudent, studentDashboardController.markAllNotificationsRead);

// Profile
router.get('/profile', authenticateStudent, profileController.getProfile);
router.patch('/profile', authenticateStudent, profileController.updateProfile);
router.post('/profile/change-password', authenticateStudent, profileController.changePassword);
router.post(
  '/profile/picture',
  authenticateStudent,
  upload.single('profilePicture'),
  profileController.updateProfilePicture
);
router.get('/profile/academic-summary', authenticateStudent, profileController.getAcademicSummary);
router.get('/profile/financial-summary', authenticateStudent, profileController.getFinancialSummary);

// Course Registration (with payment verification)
router.get('/courses/available', authenticateStudent, courseRegistrationController.getAvailableCourses);
router.post(
  '/courses/register',
  authenticateStudent,
  verifyPaymentStatus,
  courseRegistrationController.registerCourses
);
router.get('/courses/registered', authenticateStudent, courseRegistrationController.getRegisteredCourses);
router.post(
  '/courses/register-carryover',
  authenticateStudent,
  courseRegistrationController.registerCarryOverCourses
);
router.delete('/courses/drop', authenticateStudent, courseRegistrationController.dropCourse);
router.get('/courses/history', authenticateStudent, courseRegistrationController.getCourseRegistrationHistory);

// Results
router.get('/results', authenticateStudent, resultsController.getResults);
router.get('/results/session/:sessionId/semester/:semester', authenticateStudent, resultsController.getSemesterResults);
router.get('/results/gpa-summary', authenticateStudent, resultsController.getGPASummary);
router.get('/results/transcript', authenticateStudent, resultsController.downloadTranscript);
router.get('/results/check/:sessionId/:semester', authenticateStudent, resultsController.checkResultsPublished);
router.get('/results/failed-courses', authenticateStudent, resultsController.getFailedCourses);

// Assignments
router.get('/assignments', authenticateStudent, assignmentController.getAssignments);
router.get('/assignments/:id', authenticateStudent, assignmentController.getAssignmentById);
router.post(
  '/assignments/submit',
  authenticateStudent,
  upload.single('assignment'),
  assignmentController.submitAssignment
);
router.get('/assignments/:assignmentId/submission', authenticateStudent, assignmentController.getSubmission);
router.get('/submissions', authenticateStudent, assignmentController.getMySubmissions);
router.get('/assignments/:assignmentId/download', authenticateStudent, assignmentController.downloadAssignmentFile);
router.get('/submissions/:submissionId/download', authenticateStudent, assignmentController.downloadSubmissionFile);

// Payments & Invoices
router.get('/invoices', authenticateStudent, paymentController.getInvoices);
router.post('/payments/initiate', authenticateStudent, paymentController.initiatePayment);
router.get('/payments/verify/:reference', authenticateStudent, paymentController.verifyPayment);
router.get('/payments/history', authenticateStudent, paymentController.getPaymentHistory);
router.get('/payments/receipt/:paymentId', authenticateStudent, paymentController.downloadReceipt);
router.get('/payments/statement', authenticateStudent, paymentController.getStatementOfAccount);
router.post('/wallet/topup', authenticateStudent, paymentController.topUpWallet);
router.get('/wallet/verify/:reference', authenticateStudent, paymentController.verifyWalletTopup);

// Documents
router.get('/documents', authenticateStudent, documentsController.getAvailableDocuments);
router.get('/documents/admission-letter', authenticateStudent, documentsController.downloadAdmissionLetter);
router.get('/documents/id-card', authenticateStudent, documentsController.downloadIDCard);
router.get('/documents/transcript', authenticateStudent, documentsController.downloadAcademicTranscript);
router.get('/documents/receipt/:paymentId', authenticateStudent, documentsController.downloadPaymentReceipt);

export default router;
