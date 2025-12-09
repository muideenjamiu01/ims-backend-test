import { Router } from 'express';
import * as applicantAuthController from '../controllers/applicantAuthController';
import { applicantAuth } from '../middleware/applicantAuth';

const router = Router();

// Public routes
router.post('/register', applicantAuthController.register);
router.post('/login', applicantAuthController.login);
router.post('/refresh', applicantAuthController.refreshToken);
router.post('/forgot-password', applicantAuthController.forgotPassword);
router.post('/reset-password', applicantAuthController.resetPassword);

// Protected routes
router.post('/logout', applicantAuth, applicantAuthController.logout);
router.post('/change-password', applicantAuth, applicantAuthController.changePassword);

export default router;
