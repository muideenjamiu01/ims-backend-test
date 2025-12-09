import express from 'express';
import { authenticate } from '../middleware/auth';
import { authenticateStudent } from '../middleware/studentAuth';
import {
  getAvailableCoursesForRegistration,
  registerForCourses,
  getRegisteredCourses,
  dropCourses,
  getStudentRegistrations,
  getRegistrationWindows,
  createRegistrationWindow,
} from '../controllers/simplifiedCourseRegistrationController';

const router = express.Router();

// Admin routes (require admin authentication)
router.post('/registration-windows', authenticate, createRegistrationWindow);
router.get('/registration-windows', authenticate, getRegistrationWindows);
router.get('/student-registrations', authenticate, getStudentRegistrations);

// Student routes (require student authentication)
router.get('/available-courses', authenticateStudent, getAvailableCoursesForRegistration);
router.post('/register', authenticateStudent, registerForCourses);
router.get('/my-registrations', authenticateStudent, getRegisteredCourses);
router.patch('/drop-courses', authenticateStudent, dropCourses);

export default router;