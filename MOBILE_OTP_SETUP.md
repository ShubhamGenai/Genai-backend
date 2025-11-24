# Mobile OTP Authentication Setup Guide

This guide explains how to set up Mobile OTP authentication using Twilio SMS service.

## 📱 Features Added

### Login Page
- **Mobile Login**: Users can log in using only their mobile number
- **OTP Verification**: Receive OTP via SMS and verify to login

### Signup Page
- **Mobile Signup**: Users can sign up with Name, Email, and Mobile Number
- **OTP Verification**: Receive OTP via SMS and verify to create account

## 🔧 Backend Setup

### 1. Install Dependencies
Twilio is already included in `package.json`. If needed, install it:
```bash
npm install twilio
```

### 2. Get Twilio Credentials

1. Sign up for a free Twilio account at [https://www.twilio.com/](https://www.twilio.com/)
2. Go to your Twilio Console Dashboard
3. Note down the following credentials:
   - **Account SID**
   - **Auth Token**
   - **Twilio Phone Number** (you'll get a free trial number)

### 3. Configure Environment Variables

Add the following to your `.env` file in the backend:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here  # Format: +1234567890
```

**Example:**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
```

### 4. Database Updates

The `User` model has been updated with new fields:
- `mobile`: Stores user's mobile number
- `isMobileVerified`: Tracks mobile verification status

These changes are automatically reflected when you restart your server.

## 📡 API Endpoints

### Login Endpoints

#### 1. Send OTP for Login
```http
POST /auth/login/send-otp
Content-Type: application/json

{
  "mobile": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully to your mobile number."
}
```

#### 2. Verify OTP for Login
```http
POST /auth/login/verify-otp
Content-Type: application/json

{
  "mobile": "9876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "mobile": "9876543210",
    "role": "student"
  }
}
```

### Signup Endpoints

#### 1. Send OTP for Signup
```http
POST /auth/signup/send-otp
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "role": "student"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully to your mobile number."
}
```

#### 2. Verify OTP for Signup
```http
POST /auth/signup/verify-otp
Content-Type: application/json

{
  "mobile": "9876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully!",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "role": "student"
  }
}
```

## 🔒 Security Features

- ✅ OTP expires after 10 minutes
- ✅ 6-digit numeric OTP
- ✅ Mobile number validation (10 digits)
- ✅ Duplicate account prevention
- ✅ JWT token generation after successful verification
- ✅ Student profile automatically created on signup

## 📝 Testing

### With Twilio Trial Account
- You can only send SMS to verified numbers
- Add test numbers in Twilio Console → Phone Numbers → Verified Caller IDs
- Limited to specific countries based on your account

### For Development/Testing Without Twilio
If you don't have Twilio credentials yet, the system will:
- Log a warning on startup
- Return error messages when trying to send OTP
- You can temporarily modify the code to log OTP to console for testing

## 🌍 International Support

The code defaults to Indian mobile numbers (+91 prefix). To change:

Edit `Genai-backend/utils/smsOTP.js`:
```javascript
// Change this line
const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

// To your country code, e.g., for US:
const formattedMobile = mobile.startsWith('+') ? mobile : `+1${mobile}`;
```

## 🎯 User Flow

### Login Flow
1. User clicks "Mobile" button on login page
2. Enters 10-digit mobile number
3. Clicks "Send OTP"
4. Receives SMS with 6-digit OTP
5. Enters OTP
6. Clicks "Verify & Login"
7. Successfully logged in

### Signup Flow
1. User clicks "Mobile" button on signup page
2. Enters Name, Email, and 10-digit mobile number
3. Clicks "Send OTP"
4. Receives SMS with 6-digit OTP
5. Enters OTP
6. Clicks "Verify & Sign Up"
7. Account created and logged in

## 🐛 Troubleshooting

### OTP not received
- Check Twilio account balance
- Verify phone number is verified in Twilio (for trial accounts)
- Check server logs for error messages
- Ensure correct country code

### Invalid credentials error
- Double-check `.env` file configuration
- Ensure no extra spaces in environment variables
- Restart your Node.js server after updating `.env`

### Database errors
- Run migrations if needed
- Ensure MongoDB connection is working
- Check User model has `mobile` and `isMobileVerified` fields

## 💰 Cost Considerations

- **Twilio Trial**: Free trial credit for testing
- **Production**: Pay as you go (approximately $0.0075 per SMS in India)
- **Alternative**: Consider other SMS providers like AWS SNS, MSG91, or Nexmo

## 🔄 Next Steps

1. **Add Environment Variables**: Update your `.env` file
2. **Test the System**: Try both login and signup flows
3. **Monitor Usage**: Keep track of SMS usage in Twilio console
4. **Production Setup**: Get a dedicated phone number for production

## 📚 Additional Resources

- [Twilio Node.js Quickstart](https://www.twilio.com/docs/sms/quickstart/node)
- [Twilio SMS Best Practices](https://www.twilio.com/docs/sms/bestpractices)
- [Twilio Pricing](https://www.twilio.com/sms/pricing)

---

**Need Help?** Check the server console logs for detailed error messages.

