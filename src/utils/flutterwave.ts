import axios from 'axios';
import logger from '../config/logger';

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || '';
const FLUTTERWAVE_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || '';
const FLUTTERWAVE_ENCRYPTION_KEY = process.env.FLUTTERWAVE_ENCRYPTION_KEY || '';

// Validate Flutterwave credentials
if (!FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY.includes('XXXX')) {
  logger.warn('Flutterwave Secret Key not configured properly. Get test keys from: https://dashboard.flutterwave.com/dashboard/settings/apis');
}

// Use correct API endpoint
const FLUTTERWAVE_BASE_URL = 'https://developersandbox-api.flutterwave.com/v3';

interface InitializePaymentData {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: {
    email: string;
    name: string;
    phonenumber?: string;
  };
  customizations?: {
    title: string;
    description: string;
    logo: string;
  };
  meta?: any;
}

export const initializePayment = async (data: InitializePaymentData) => {
  try {
    // Validate secret key format
    if (!FLUTTERWAVE_SECRET_KEY || FLUTTERWAVE_SECRET_KEY.includes('XXXX')) {
      logger.error('Invalid Flutterwave Secret Key. Please check your .env file.');
      return {
        success: false,
        error: 'Flutterwave not configured. Please contact administrator.',
      };
    }

    logger.info('Initializing Flutterwave payment with data:', {
      tx_ref: data.tx_ref,
      amount: data.amount,
      email: data.customer.email,
    });

    const response = await axios.post(
      `${FLUTTERWAVE_BASE_URL}/payments`,
      data,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Flutterwave initialization response:', response.data);

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    logger.error('Flutterwave initialization error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers,
    });
    
    const errorMessage = error.response?.data?.message || error.message || 'Payment initialization failed';
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const verifyPayment = async (transactionId: string) => {
  try {
    const response = await axios.get(
      `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    logger.error('Flutterwave verification error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Payment verification failed',
    };
  }
};

export const getAllBanks = async () => {
  try {
    const response = await axios.get(`${FLUTTERWAVE_BASE_URL}/banks/NG`, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    return {
      success: true,
      data: response.data.data,
    };
  } catch (error: any) {
    logger.error('Flutterwave banks error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to get banks',
    };
  }
};
