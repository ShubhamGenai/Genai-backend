const twilio = require('twilio');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client;

// Initialize Twilio client only if credentials are provided
if (accountSid && authToken && twilioPhoneNumber) {
  client = twilio(accountSid, authToken);
  console.log('✅ Twilio SMS service initialized');
} else {
  console.warn('⚠️ Twilio credentials not configured. SMS OTP will not work.');
}

// Generate a 6-digit OTP
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP via SMS
const sendOtpSms = async (mobile, otp) => {
  try {
    if (!client) {
      console.error('Twilio client not initialized. Please configure Twilio credentials.');
      throw new Error('SMS service not configured');
    }

    // Ensure mobile number has country code (default to +91 for India if not present)
    const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

    const message = await client.messages.create({
      body: `Your Gen AI verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
      from: twilioPhoneNumber,
      to: formattedMobile
    });

    console.log(`✅ OTP SMS sent successfully to ${formattedMobile}. SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('❌ Error sending OTP SMS:', error.message);
    throw error;
  }
};

module.exports = {
  generateOtp,
  sendOtpSms
};

