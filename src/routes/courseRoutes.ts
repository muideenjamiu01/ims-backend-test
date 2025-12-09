import express from 'express';
import * as courseController from '../controllers/courseController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  courseController.createCourse
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  courseController.getCourses
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  courseController.getCourseById
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  courseController.updateCourse
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  courseController.deleteCourse
);

router.post(
  '/register',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  courseController.registerCourse
);

router.get(
  '/student/:studentId',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  courseController.getStudentCourses
);

export default router;
