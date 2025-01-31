const User = require("../models/UserModel");
const { sendOtpEmail } = require('../utils/emailOTP');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config();


const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
    let user = await User.findOne({ email });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: "User already exists and is verified." });
      }

      // If user exists but is not verified, update details
      user.name = name;
      user.password = await bcrypt.hash(password, 10);
      user.role = role;

      // Generate a new OTP
      user.otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Save the updated user and send OTP in parallel
      await Promise.all([user.save(), sendOtpEmail(email, user.otp)]);

      return res.status(200).json({
        success: true,
        message: "User information updated. A new OTP has been sent to your email. Please verify your account."
      });
    }

    // If no existing user, create a new one
    const hashedPassword = await bcrypt.hash(password, 10);

    user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      isVerified: false,
      otp: Math.floor(100000 + Math.random() * 900000).toString(),
    });

    // Save the new user and send OTP in parallel
    await Promise.all([user.save(), sendOtpEmail(email, user.otp)]);

    res.status(201).json({
      success: true,
      message: "User registered successfully. OTP sent to your email. Please verify your account.",
    });

  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};


const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Check if OTP matches
    if (user.otp === otp) {
      // Mark user as verified
      user.isVerified = true;
      user.isEmailVerified = true;
      user.otp = null;  // Clear the OTP after successful verification

      // Save the user's updated status
      await user.save();

      return res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Error during OTP verification:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


const completeProfile = async (req, res) => {
  const { email, name, contact, qualification, interest } = req.body;
  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Update user's profile details
    user.name = name || user.name;
    user.contact = contact || user.contact;
    user.qualification = qualification || user.qualification;
    user.interest = interest || user.interest;
    await user.save();

    // Generate a JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Adjust token expiration as needed
    );

    res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        contact: user.contact,
        qualification: user.qualification,
        interest: user.interest,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error during profile completion:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No account found with these credentials.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'User is not verified. Please check your email to verify your account.',
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};




module.exports = {
  registerUser,
  verifyOtp,
  completeProfile,
  loginUser



}