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
    // Validate inputs
    if (!mobile || !otp) {
      throw new Error('Mobile number and OTP are required');
    }

    if (!client) {
      console.error('❌ Twilio client not initialized. Please configure Twilio credentials.');
      throw new Error('SMS service not configured');
    }

    // Ensure mobile number has country code (default to +91 for India if not present)
    const formattedMobile = mobile.startsWith('+') ? mobile : `+91${mobile}`;

    console.log(`📱 Attempting to send OTP SMS to: ${formattedMobile}`);

    const message = await client.messages.create({
      body: `Your Gen AI verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
      from: twilioPhoneNumber,
      to: formattedMobile
    });

    // Log success with detailed information
    console.log(`✅ OTP SMS sent successfully!`);
    console.log(`   - Recipient: ${formattedMobile}`);
    console.log(`   - Message SID: ${message.sid}`);
    console.log(`   - Status: ${message.status}`);
    console.log(`   - From: ${twilioPhoneNumber}`);
    
    return { 
      success: true, 
      sid: message.sid,
      status: message.status,
      to: formattedMobile
    };
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Error sending OTP SMS:');
    console.error(`   - Mobile: ${mobile}`);
    console.error(`   - Error: ${error.message}`);
    if (error.code) {
      console.error(`   - Error Code: ${error.code}`);
    }
    if (error.moreInfo) {
      console.error(`   - More Info: ${error.moreInfo}`);
    }
    throw new Error(`Failed to send OTP SMS: ${error.message}`);
  }
};

module.exports = {
  generateOtp,
  sendOtpSms
};

