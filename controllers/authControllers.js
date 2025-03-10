const User = require("../models/UserModel");
const { sendOtpEmail } = require('../utils/emailOTP');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config();

require('../config/passport');
const passport = require('passport');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.CLIENTID);

const registerUser = async (req, res) => {


  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
    let user = await User.findOne({ email });

    if (user) {
      if (user.isVerified) {
        return res.status(400).json({ success: false, message: "User already exists and is verified." });
      }

      // If user exists but is not verified, update details
      user.name = fullName;
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
      name: fullName,
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
  console.log("Login Request:", req.body);

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  try {
    // Using an immediately invoked function expression (IIFE)
    const response = await (async () => {
      // Fetch user and check if exists
      const user = await User.findOne({ email }).select("+password").lean();
      if (!user) return { status: 400, message: "Invalid credentials." };

      // Compare password
      if (!(await bcrypt.compare(password, user.password))) {
        return { status: 401, message: "Invalid credentials." };
      }

      // Check verification status
      if (!user.isVerified) {
        return { status: 403, message: "Please verify your account via email." };
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user._id, role: user.role, name: user.name, isProfileVerified: user.isProfileVerified },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      return {
        status: 200,
        success: true,
        message: "Login successful.",
        token,
        user: { id: user._id, username: user.username, email: user.email, role: user.role, name: user.name },
      };
    })();

    return res.status(response.status).json(response);
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};




const restpassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // Random 6-digit OTP

    // Save OTP to user's account
    user.otp = otp.toString(); // Store OTP as a string
    await user.save();

    // Send OTP via email
    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ error: 'Something went wrong' });
  }
};


const verifyResetOtp = async (req, res) => {
  const { otp, email } = req.body;

  try {
    // Find user in the database using the provided email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Check if the OTP matches the one stored in the user's record
    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // OTP matches, set the user's OTP field to null
    user.otp = null;
    await user.save();

    res.json({ success: true, message: 'OTP verified and cleared' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


const setPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password and clear OTP (if using OTP reset flow)
    user.password = hashedPassword;
    user.otp = null; // Optional: Clear OTP after password reset if you used OTP for reset
    await user.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


// Google Login
const googlelogin = (req, res, next) => {
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

const googleCallback = (req, res) => {
  passport.authenticate('google', (err, userObj) => {
    if (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({ error: 'Authentication failed' });
    }
    if (!userObj) {
      return res.status(400).json({ error: 'User not found' });
    }

    const { user, token } = userObj;  // Destructure user and token from the returned object

    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }

      // Construct the redirect URL with the token and user ID
      const redirectUrl = `https://www.genailearning.in/auth/callback?token=${token}&id=${user._id}&role=${user.role}`;

      // Redirect to the frontend application with the token in the query parameters
      res.redirect(redirectUrl);
    });
  })(req, res);
};


const getUserDetails = async (req, res) => {
  console.log("here");
  

  try {
    const user = await User.findById(req.user.id).select('-password');
    
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};





module.exports = {
  registerUser,
  verifyOtp,
  completeProfile,
  loginUser,
  restpassword,
  verifyResetOtp,
  setPassword,

  googlelogin,
  googleCallback,
  getUserDetails,





}