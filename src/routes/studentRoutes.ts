import express from 'express';
import * as studentController from '../controllers/studentController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  studentController.createStudent
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  studentController.getStudents
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  studentController.getStudentById
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  studentController.updateStudent
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  studentController.deleteStudent
);

router.get(
  '/:id/transcript',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  studentController.getStudentTranscript
);

export default router;
