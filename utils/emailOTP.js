const otpGenerator = require('otp-generator');
const nodemailer = require('nodemailer');
const emailConfig = require('../config/emailConfig');

// Create a Nodemailer transporter with connection pooling
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: emailConfig.auth.user,
    pass: emailConfig.auth.pass
  },
  pool: true, // Enables connection pooling
  maxConnections: 5, // Limits concurrent connections
  maxMessages: 10, // Messages per connection
});

// Generate a 6-digit OTP (numeric only) - Optimized
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP email asynchronously
const sendOtpEmail = async (email, otp) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .container { width: 80%; margin: 0 auto; text-align: center; }
        .logo { margin-bottom: 20px; }
        .details { margin-top: 20px; }
        .otp { font-size: 24px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://thementor.live/wp-content/uploads/2021/10/Google-Logo-300x124.png" alt="Company Logo" class="logo" width="150">
        <h1>Your OTP Code</h1>
        <p class="details">Your OTP code is <span class="otp">${otp}</span>.</p>
        <p>If you did not request this OTP, please ignore this email.</p>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: emailConfig.auth.user,
    to: email,
    subject: 'Your OTP Code',
    html: htmlContent
  };

  setImmediate(async () => {
    try {
      await transporter.sendMail(mailOptions);
      console.log('OTP email sent successfully.');
    } catch (error) {
      console.error('Error sending OTP email:', error);
    }
  });
};

module.exports = {
  generateOtp,
  sendOtpEmail
};
