import express from 'express';
import {
  createSession,
  getAllSessions,
  getSession,
  updateSession,
  deleteSession,
  getActiveSession,
  createSemester,
  getSessionSemesters,
  getSemester,
  updateSemester,
  deleteSemester,
  getActiveSemester,
} from '../controllers/sessionController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticate);

// Session routes
router.post('/', createSession);
router.get('/', getAllSessions);
router.get('/active', getActiveSession);
router.get('/:id', getSession);
router.patch('/:id', updateSession);
router.delete('/:id', deleteSession);

// Semester routes
router.post('/:sessionId/semesters', createSemester);
router.get('/:sessionId/semesters', getSessionSemesters);
router.get('/semesters/active', getActiveSemester);
router.get('/semesters/:id', getSemester);
router.patch('/semesters/:id', updateSemester);
router.delete('/semesters/:id', deleteSemester);

export default router;
