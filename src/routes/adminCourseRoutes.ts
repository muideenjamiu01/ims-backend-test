import express from 'express';
import * as adminCourseController from '../controllers/adminCourseController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

/**
 * Get all course registrations
 * GET /api/admin/course-registrations
 * Query params: page, limit, status, sessionId, semesterId, level, departmentId, search
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  adminCourseController.getAllRegistrations
);

/**
 * Get registration statistics
 * GET /api/admin/course-registrations/stats
 * Query params: sessionId, semesterId
 */
router.get(
  '/stats',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  adminCourseController.getRegistrationStats
);

/**
 * Export registrations to Excel
 * GET /api/admin/course-registrations/export
 * Query params: sessionId, semesterId, status, departmentId
 */
router.get(
  '/export',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  adminCourseController.exportRegistrations
);

/**
 * Approve a course registration
 * POST /api/admin/course-registrations/:id/approve
 * Body: { comments? }
 */
router.post(
  '/:id/approve',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  adminCourseController.approveRegistration
);

/**
 * Reject a course registration
 * POST /api/admin/course-registrations/:id/reject
 * Body: { comments }
 */
router.post(
  '/:id/reject',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  adminCourseController.rejectRegistration
);

/**
 * Return a course registration for revision
 * POST /api/admin/course-registrations/:id/return
 * Body: { comments }
 */
router.post(
  '/:id/return',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  adminCourseController.returnRegistration
);

export default router;
