import express from 'express';
import * as studentCourseController from '../controllers/studentCourseController';
import { authenticateStudent } from '../middleware/studentAuth';

const router = express.Router();

/**
 * Get available courses for registration
 * GET /api/student/courses/available
 * Query params: sessionId, semesterId, level
 */
router.get(
  '/available',
  authenticateStudent,
  studentCourseController.getAvailableCourses
);

/**
 * Validate course registration before submission
 * POST /api/student/courses/validate
 * Body: { courseIds, sessionId, semesterId, level }
 */
router.post(
  '/validate',
  authenticateStudent,
  studentCourseController.validateRegistration
);

/**
 * Submit course registration
 * POST /api/student/courses/register
 * Body: { courseIds, sessionId, semesterId, level }
 */
router.post(
  '/register',
  authenticateStudent,
  studentCourseController.submitRegistration
);

/**
 * Get my registration history
 * GET /api/student/courses/my-registrations
 * Query params: page, limit
 */
router.get(
  '/my-registrations',
  authenticateStudent,
  studentCourseController.getMyRegistrations
);

/**
 * Get specific registration details
 * GET /api/student/courses/registrations/:id
 */
router.get(
  '/registrations/:id',
  authenticateStudent,
  studentCourseController.getRegistrationDetails
);

/**
 * Download course form as PDF
 * GET /api/student/courses/registrations/:id/download
 */
router.get(
  '/registrations/:id/download',
  authenticateStudent,
  studentCourseController.downloadRegistrationForm
);

export default router;
