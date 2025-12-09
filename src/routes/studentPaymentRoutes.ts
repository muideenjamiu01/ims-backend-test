import express from 'express';
import {
  getInvoices,
  getPaymentHistory,
  getWalletBalance,
  initializePayment,
  payWithWallet,
  verifyPayment,
  downloadReceipt,
  getPaymentStats,
} from '../controllers/studentPaymentController';
import { authenticateStudent } from '../middleware/studentAuth';

const router = express.Router();

// Public route for payment verification (no auth required for gateway redirects)
router.get('/verify', verifyPayment);

// Apply student authentication to all other routes
router.use(authenticateStudent);

// Get invoices
router.get('/invoices', getInvoices);

// Get payment history
router.get('/history', getPaymentHistory);

// Get wallet balance
router.get('/wallet/balance', getWalletBalance);

// Get payment statistics
router.get('/stats', getPaymentStats);

// Initialize payment
router.post('/initialize', initializePayment);

// Pay with wallet
router.post('/wallet/pay', payWithWallet);

// Download payment receipt
router.get('/receipt/:paymentId', downloadReceipt);

export default router;