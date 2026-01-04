import express from 'express';
import { getAllSessions, getSession, getActiveSession, getSessionSemesters, getActiveSemester } from '../controllers/sessionController';
import { authenticateStudent } from '../middleware/studentAuth';

const router = express.Router();

// Apply student authentication to all routes
router.use(authenticateStudent);

// Session routes (read-only for students)
router.get('/', getAllSessions);
router.get('/active', getActiveSession);
router.get('/:id', getSession);

// Semester routes (read-only for students)
router.get('/:sessionId/semesters', getSessionSemesters);
router.get('/semesters/active', getActiveSemester);

export default router;
