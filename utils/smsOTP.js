const { generateOtp } = require('./otpUtils');
const { sendSmsBitsOtp } = require('./smsBitsOTP');

// Send OTP via SMS using SMSBits (Indian 10-digit numbers only)
const sendOtpSms = async (mobile, otp, options = {}) => {
  try {
    if (!mobile || !otp) {
      throw new Error('Mobile number and OTP are required');
    }

    console.log(`📱 Attempting to send OTP SMS via SMSBits to: ${mobile}`);

    const result = await sendSmsBitsOtp(mobile, otp, options);

    console.log('✅ OTP SMS sent successfully via SMSBits');
    console.log(`   - Recipient: ${result.to}`);
    console.log(`   - HTTP Code: ${result.httpCode}`);
    console.log(`   - Raw Response: ${result.rawResponse}`);

    return result;
  } catch (error) {
    console.error('❌ Error sending OTP SMS via SMSBits:');
    console.error(`   - Mobile: ${mobile}`);
    console.error(`   - Error: ${error.message}`);
    throw new Error(`Failed to send OTP SMS: ${error.message}`);
  }
};

module.exports = {
  generateOtp,
  sendOtpSms,
};


