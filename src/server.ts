import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/authRoutes';
import admissionRoutes from './routes/admissionRoutes';
import studentRoutes from './routes/studentRoutes';
import courseRoutes from './routes/courseRoutes';
import examRoutes from './routes/examRoutes';
import departmentRoutes from './routes/departmentRoutes';
import studentPortalRoutes from './routes/studentPortalRoutes';
import applicantAuthRoutes from './routes/applicantAuthRoutes';
import applicantProfileRoutes from './routes/applicantProfileRoutes';
import applicantUploadRoutes from './routes/applicantUploadRoutes';
import webhookRoutes from './routes/webhookRoutes';
import applicantPaymentRoutes from './routes/applicantPaymentRoutes';
import studentPaymentRoutes from './routes/studentPaymentRoutes';
import adminPaymentRoutes from './routes/adminPaymentRoutes';
import enhancedCourseRegistrationRoutes from './routes/enhancedCourseRegistrationRoutes';
import sessionRoutes from './routes/sessionRoutes';
import paymentTypeRoutes from './routes/paymentTypeRoutes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - Required when running behind reverse proxy (nginx, load balancer, etc.)
// This enables Express to trust X-Forwarded-* headers for proper client IP detection
app.set('trust proxy', true);
 
// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images to be loaded cross-origin
}));
// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.STUDENT_PORTAL_URL || 'http://localhost:3000', 
      process.env.APPLICANT_PORTAL_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://institution-management-system.vercel.app', // Add your production frontend URL
      'https://institution-management-system.vercel.app/student/login', // Add your production student portal URL
      'https://institution-management-system.vercel.app/applicant/login' // Add your production applicant portal URL
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs (increased from 1000)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Lenient rate limit for profile endpoints (higher frequency allowed)
const profileLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (shorter window)
  max: 200, // 200 requests per 5 minutes for profile endpoints (more generous)
  message: 'Too many profile requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Very lenient rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply specific limiters first (more specific paths)
app.use('/api/applicant/profile', profileLimiter);
app.use('/api/student/profile', profileLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/applicant/auth/', authLimiter);
app.use('/api/student/auth/', authLimiter);

// Apply general limiter to remaining /api/ paths (exclude already handled paths)
app.use('/api/', (req, res, next) => {
  const path = req.path;
  // Skip general limiter for paths that already have specific limiters
  if (path.startsWith('/applicant/profile') || 
      path.startsWith('/student/profile') || 
      path.startsWith('/auth/') || 
      path.startsWith('/applicant/auth/') || 
      path.startsWith('/student/auth/')) {
    return next();
  }
  limiter(req, res, next);
});

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads) - must be before routes
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/departments', departmentRoutes);

// Student Portal Routes
app.use('/api/student', studentPortalRoutes);

// Enhanced Course Registration Routes
app.use('/api/course-registration', enhancedCourseRegistrationRoutes);

// Applicant Portal Routes
app.use('/api/applicant/auth', applicantAuthRoutes);
app.use('/api/applicant', applicantProfileRoutes);
app.use('/api/applicant/upload', applicantUploadRoutes);
app.use('/api/applicant/payment', applicantPaymentRoutes);

// Student Payment Routes
app.use('/api/student/payments', studentPaymentRoutes);

// Admin Payment Routes
app.use('/api/admin/payments', adminPaymentRoutes);

// Admin Session Routes
app.use('/api/admin/sessions', sessionRoutes);

// Admin Payment Type Routes
app.use('/api/admin/payment-types', paymentTypeRoutes);

// Webhook Routes (payment gateways)
app.use('/api/webhooks', webhookRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
