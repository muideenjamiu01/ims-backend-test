import express from 'express';
import { applicantAuth } from '../middleware/applicantAuth';
import {
  initializeApplicationFee,
  initializeAcceptanceFee,
  verifyPayment,
  getPaymentHistory,
} from '../controllers/applicantPaymentController';

const router = express.Router();

// Auth check endpoint (for debugging)
router.get('/auth-check', applicantAuth, (req: any, res) => {
  res.json({
    success: true,
    message: 'Authenticated',
    applicant: req.applicant,
  });
});

router.use(applicantAuth);

router.post('/application-fee/initialize', initializeApplicationFee);
router.post('/acceptance-fee/initialize', initializeAcceptanceFee);
router.get('/verify/:reference', verifyPayment);
router.get('/history', getPaymentHistory);

export default router;
