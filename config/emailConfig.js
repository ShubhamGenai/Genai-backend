const dotenv= require("dotenv")
dotenv.config();

module.exports = {
    host: 'smtp.gmail.com', // or your email provider's SMTP server
    port: 587, // port for TLS
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.GOOGLE_EMAIL, // your email address
      pass: process.env.PASS// your email password or app-specific password
    }
  };
  