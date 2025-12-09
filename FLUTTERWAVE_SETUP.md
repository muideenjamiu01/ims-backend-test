# Flutterwave Integration Setup Guide

## Getting Your API Keys

### Step 1: Create/Login to Flutterwave Account
1. Go to [https://dashboard.flutterwave.com/signup](https://dashboard.flutterwave.com/signup)
2. Sign up for a new account or login to your existing account
3. Complete account verification if required

### Step 2: Get Your Test API Keys
1. Navigate to **Settings** → **API Keys** in your dashboard
2. You'll find three keys for TEST mode:
   - **Public Key** (starts with `FLWPUBK_TEST-`)
   - **Secret Key** (starts with `FLWSECK_TEST-`)
   - **Encryption Key** (starts with `FLWSECK_TEST`)

### Step 3: Update Your .env File
Copy your keys and update the `.env` file:

```env
# Flutterwave Test Keys
FLUTTERWAVE_SECRET_KEY="FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X"
FLUTTERWAVE_PUBLIC_KEY="FLWPUBK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X"
FLUTTERWAVE_ENCRYPTION_KEY="FLWSECK_TESTxxxxxxxxxxxxxxxx"
```

### Key Format Examples:
- **Secret Key**: `FLWSECK_TEST-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p-X`
- **Public Key**: `FLWPUBK_TEST-9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k-X`
- **Encryption Key**: `FLWSECK_TEST1a2b3c4d5e6f`

## Important Notes

### Current Issue
The keys in your `.env` file don't match the correct Flutterwave format:
- ❌ Your current secret key: `4e73c396-fb1b-4b2a-adfa-1a077cd7f276`
- ✅ Expected format: `FLWSECK_TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-X`

### API Documentation
- Flutterwave API Docs: [https://developer.flutterwave.com/docs](https://developer.flutterwave.com/docs)
- Standard Payments: [https://developer.flutterwave.com/docs/integration-guides/standard](https://developer.flutterwave.com/docs/integration-guides/standard)

### Testing
1. After updating your keys, restart the backend server
2. Test payment initialization from the applicant portal
3. Check backend logs for detailed error messages

### Troubleshooting

**"Invalid authorization key" Error:**
- Verify your secret key starts with `FLWSECK_TEST-`
- Ensure there are no extra spaces in the `.env` file
- Make sure you're copying the **Secret Key**, not the Public Key

**Payment Gateway Selection:**
- If Flutterwave continues to have issues, you can use **Paystack** as an alternative
- Paystack keys are already configured correctly in your `.env`

## Switch Between Test and Live Mode

### Test Mode (Development)
- Use keys that start with `FLWSECK_TEST-` and `FLWPUBK_TEST-`
- No real money is charged
- Perfect for development and testing

### Live Mode (Production)
- Use keys that start with `FLWSECK-` and `FLWPUBK-`
- Real money transactions
- Requires business verification on Flutterwave

## Support
If you continue to face issues:
1. Check the backend console logs for detailed error messages
2. Contact Flutterwave support: [https://support.flutterwave.com](https://support.flutterwave.com)
3. Use Paystack as an alternative payment gateway
