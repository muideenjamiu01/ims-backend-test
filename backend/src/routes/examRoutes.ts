import express from 'express';
import * as examController from '../controllers/examController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.createExam
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.getExams
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.getExamById
);

router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.updateExam
);

router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  examController.deleteExam
);

router.post(
  '/scores',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.recordScore
);

router.get(
  '/:examId/scores',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.getExamScores
);

router.get(
  '/:examId/analytics',
  authenticate,
  authorize('ADMIN', 'STAFF'),
  examController.getExamAnalytics
);

export default router;
