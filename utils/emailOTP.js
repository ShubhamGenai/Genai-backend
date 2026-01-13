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

// Verify transporter configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error);
  } else {
    console.log('✅ Email transporter is ready to send emails');
    console.log(`   - Service: Gmail`);
    console.log(`   - From: ${emailConfig.auth.user}`);
  }
});

// Generate a 6-digit OTP (numeric only) - Optimized
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP email asynchronously
const sendOtpEmail = async (email, otp) => {
  try {
    // Validate inputs
    if (!email || !otp) {
      throw new Error('Email and OTP are required');
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f9fafb;
      color: #111827;
      margin: 0;
      padding: 0;
    }
    .container {
      width: 90%;
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
      text-align: center;
      padding: 30px;
    }
    .logo-text {
      font-weight: bold;
      font-size: 28px;
      line-height: 1.2;
      margin-bottom: 20px;
      letter-spacing: -0.5px;
    }
    .gradient-text {
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      transition: background 0.5s ease;
    }
    .details {
      margin-top: 20px;
      font-size: 16px;
      color: #374151;
    }
    .otp {
      font-size: 26px;
      font-weight: bold;
      color: #111827;
    }
    .footer {
      margin-top: 40px;
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="logo-text">
      Gen <span class="gradient-text">AI</span>
    </h1>
    <h2>Your OTP Code</h2>
    <p class="details">
       <span class="otp">${otp}</span>.
    </p>
    <p>If you did not request this OTP, please ignore this email.</p>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Gen AI. All rights reserved.
    </div>
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

    console.log(`📧 Attempting to send OTP email to: ${email}`);

    // Send email and wait for it to complete
    const info = await transporter.sendMail(mailOptions);
    
    // Log success with detailed information
    console.log(`✅ OTP email sent successfully!`);
    console.log(`   - Recipient: ${email}`);
    console.log(`   - Message ID: ${info.messageId}`);
    console.log(`   - Response: ${info.response || 'N/A'}`);
    console.log(`   - From: ${emailConfig.auth.user}`);
    
    return info;
  } catch (error) {
    // Enhanced error logging
    console.error('❌ Error sending OTP email:');
    console.error(`   - Email: ${email}`);
    console.error(`   - Error: ${error.message}`);
    if (error.code) {
      console.error(`   - Error Code: ${error.code}`);
    }
    if (error.response) {
      console.error(`   - Response: ${error.response}`);
    }
    if (error.responseCode) {
      console.error(`   - Response Code: ${error.responseCode}`);
    }
    // Re-throw the error so the caller can handle it
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

module.exports = {
  generateOtp,
  sendOtpEmail
};
