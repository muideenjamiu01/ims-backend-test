import express from 'express';
import {
  createSession,
  getAllSessions,
  getSession,
  updateSession,
  deleteSession,
  getActiveSession,
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

export default router;
