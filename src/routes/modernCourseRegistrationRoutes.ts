import express from 'express';
import {
  getRegistrationWindowStatus,
  getAvailableCoursesModern,
  registerCoursesModern,
  getMyRegisteredCourses,
  dropCourse,
  createRegistrationWindow,
  getRegistrationWindows,
  getRegistrationStatistics
} from '../controllers/modernCourseRegistrationController';
import { authenticate } from '../middleware/auth';
import { authenticateStudent } from '../middleware/studentAuth';

const router = express.Router();

// Student routes
router.get('/status', authenticateStudent, getRegistrationWindowStatus);
router.get('/available-courses', authenticateStudent, getAvailableCoursesModern);
router.post('/register', authenticateStudent, registerCoursesModern);
router.get('/my-courses', authenticateStudent, getMyRegisteredCourses);
router.delete('/drop/:registrationId', authenticateStudent, dropCourse);

// Admin routes
router.post('/windows', authenticate, createRegistrationWindow);
router.get('/windows', authenticate, getRegistrationWindows);
router.get('/statistics', authenticate, getRegistrationStatistics);

export default router;
