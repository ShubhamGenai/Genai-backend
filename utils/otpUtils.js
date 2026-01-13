/**
 * OTP Utility Functions
 * Centralized OTP generation for consistent use across the application
 */

/**
 * Generate a 6-digit numeric OTP
 * @returns {string} A 6-digit OTP as a string (e.g., "123456")
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate OTP with expiration time
 * @param {number} expirationMinutes - OTP expiration time in minutes (default: 10)
 * @returns {Object} Object containing OTP and expiration date
 */
const generateOtpWithExpiration = (expirationMinutes = 10) => {
  const otp = generateOtp();
  const otpExpires = new Date(Date.now() + expirationMinutes * 60 * 1000);
  
  return {
    otp,
    otpExpires
  };
};

module.exports = {
  generateOtp,
  generateOtpWithExpiration
};
