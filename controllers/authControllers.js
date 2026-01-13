const User = require("../models/UserModel");
const Student = require("../models/studentSchema")
const { sendOtpEmail } = require('../utils/emailOTP');
const { sendOtpSms } = require('../utils/smsOTP');
const { generateOtp, generateOtpWithExpiration } = require('../utils/otpUtils');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config();
const admin = require("firebase-admin");
require('../config/passport');
const passport = require('passport');
const { OAuth2Client } = require('google-auth-library');
const Employer = require("../models/EmployerModel");
const Admin = require("../models/adminModel");
const ContentManager = require("../models/ContentManagerModel");
const client = new OAuth2Client(process.env.CLIENTID);



const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Input validation
    if (!fullName || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, Email, and Password are required." 
      });
    }

    // Sanitize and normalize inputs
    const sanitizedName = fullName.trim();
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedPassword = password.trim();

    // Validate inputs
    if (sanitizedName.length < 2 || sanitizedName.length > 50) {
      return res.status(400).json({ 
        success: false, 
        message: "Name must be between 2 and 50 characters." 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid email address." 
      });
    }

    if (trimmedPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters long." 
      });
    }

    // Check if user exists (optimized query - only select needed fields)
    const existingUser = await User.findOne({ email: normalizedEmail })
      .select('isEmailVerified isVerified isProfileVerified')
      .lean();

    if (existingUser) {
      if (existingUser.isEmailVerified || existingUser.isVerified || existingUser.isProfileVerified) {
        return res.status(400).json({ 
          success: false, 
          message: "Email already exists. Please login instead." 
        });
      }
      return res.status(400).json({ 
        success: false, 
        message: "Email already exists. Please use 'Resend OTP' if you haven't received the verification code." 
      });
    }

    // Generate OTP and hash password in parallel for better performance
    const [{ otp: newOtp, otpExpires }, hashedPassword] = await Promise.all([
      Promise.resolve(generateOtpWithExpiration(10)),
      bcrypt.hash(trimmedPassword, 10)
    ]);

    // Create and save user
    const newUser = new User({
      name: sanitizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "student",
      otp: newOtp,
      otpExpires: otpExpires,
    });

    await newUser.save();

    // Send email asynchronously (non-blocking)
    setImmediate(() => {
      sendOtpEmail(normalizedEmail, newOtp).catch(err => {
        console.error(`Failed to send OTP email to ${normalizedEmail}:`, err.message);
      });
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email using the OTP sent.",
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Email already exists. Please login instead." 
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: error.message || "Validation error. Please check your input." 
      });
    }
    console.error("Error in registerUser:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again later." 
    });
  }
};





const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    // Find user with only needed fields
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('otp otpExpires role isEmailVerified isVerified');

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Check OTP expiration
    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    // Verify OTP
    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // Update user and create student profile in parallel
    const updatePromise = User.updateOne(
      { email: email.toLowerCase().trim() },
      { 
        $set: { isEmailVerified: true, isVerified: true },
        $unset: { otp: "", otpExpires: "" }
      }
    );

    let studentPromise = Promise.resolve();
    if (user.role === "student") {
      studentPromise = Student.findOneAndUpdate(
        { userId: user._id },
        { userId: user._id },
        { upsert: true, new: true }
      );
    }

    await Promise.all([updatePromise, studentPromise]);

    return res.status(200).json({ success: true, message: "OTP verified successfully!" });

  } catch (error) {
    console.error("Error in verifyOtp:", error.message);
    return res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('_id');

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Generate OTP and update in single operation
    const { otp: newOtp, otpExpires } = generateOtpWithExpiration(10);
    
    await User.updateOne(
      { email: normalizedEmail },
      { $set: { otp: newOtp, otpExpires: otpExpires } }
    );

    // Send email asynchronously (non-blocking)
    setImmediate(() => {
      sendOtpEmail(normalizedEmail, newOtp).catch(err => {
        console.error(`Failed to send OTP email to ${normalizedEmail}:`, err.message);
      });
    });

    return res.status(200).json({ success: true, message: "New OTP sent successfully!" });
  } catch (error) {
    console.error("Error in resendOtp:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const completeProfile = async (req, res) => {
  try {
    const { email, name, contact, qualification, interest } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail })
      .select('_id email role name contact qualification interest')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update only provided fields
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (contact) updateData.contact = contact.trim();
    if (qualification) updateData.qualification = qualification.trim();
    if (interest) updateData.interest = interest.trim();

    if (Object.keys(updateData).length > 0) {
      await User.updateOne({ email: normalizedEmail }, { $set: updateData });
      Object.assign(user, updateData);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
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
    console.error('Error during profile completion:', error.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Fetch user with password (optimized - only select needed fields)
    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select("+password")
      .select("_id role name email isVerified isProfileVerified")
      .lean();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: "Please verify your account via email." });
    }

    if (user.role !== "student") {
      return res.status(403).json({ success: false, message: "No student registered with this email" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, isProfileVerified: user.isProfileVerified },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: { id: user._id, email: user.email, role: user.role, name: user.name },
    });

  } catch (error) {
    console.error("Error during login:", error.message);
    return res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};




const restpassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('_id').lean();

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Generate OTP and update in single operation
    const otp = generateOtp();
    await User.updateOne(
      { email: normalizedEmail },
      { $set: { otp: otp } }
    );

    // Send email asynchronously (non-blocking)
    setImmediate(() => {
      sendOtpEmail(normalizedEmail, otp).catch(err => {
        console.error(`Failed to send password reset OTP to ${normalizedEmail}:`, err.message);
      });
    });

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error("Error in restpassword:", error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


const verifyResetOtp = async (req, res) => {
  try {
    const { otp, email } = req.body;

    if (!otp || !email) {
      return res.status(400).json({ success: false, message: 'OTP and email are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('otp').lean();

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear OTP in single operation
    await User.updateOne(
      { email: normalizedEmail },
      { $unset: { otp: "" } }
    );

    return res.json({ success: true, message: 'OTP verified and cleared' });
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


const setPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email and new password are required' });
    }

    if (newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('_id').lean();

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    // Hash password and update in single operation
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    await User.updateOne(
      { email: normalizedEmail },
      { 
        $set: { password: hashedPassword },
        $unset: { otp: "" }
      }
    );

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};


// Google Login
// const googlelogin = (req, res, next) => {
//   passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
// };


const googlelogin = async (req, res) => {
  try {
    const { name, email, firebaseUid } = req.body;

    if (!name || !email || !firebaseUid) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, and Firebase UID are required." 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const sanitizedName = name.trim();

    // Find or create user
    let user = await User.findOne({ email: normalizedEmail })
      .select('_id role name email isProfileVerified googleId')
      .lean();
    
    if (!user) {
      // Create new user and student profile in parallel
      const newUser = await User.create({
        name: sanitizedName,
        email: normalizedEmail,
        googleId: firebaseUid,
        password: null,
        isEmailVerified: true,
        isVerified: true,
        role: "student",
      });

      // Create student profile asynchronously (non-blocking)
      setImmediate(() => {
        Student.create({ userId: newUser._id }).catch(err => {
          console.error('Failed to create student profile:', err.message);
        });
      });

      user = {
        _id: newUser._id,
        role: newUser.role,
        name: newUser.name,
        email: newUser.email,
        isProfileVerified: newUser.isProfileVerified
      };
    } else {
      // Update existing user with Google ID if not set
      if (!user.googleId) {
        await User.updateOne(
          { email: normalizedEmail },
          { 
            $set: { 
              googleId: firebaseUid, 
              isEmailVerified: true, 
              isVerified: true 
            } 
          }
        );
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        name: user.name, 
        isProfileVerified: user.isProfileVerified 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Google login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isProfileVerified: user.isProfileVerified
      }
    });

  } catch (error) {
    console.error("Google login error:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again later." 
    });
  }
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
  try {
    const baseUser = await User.findById(req.user.id).select("-password -__v").lean();
    
    if (!baseUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch additional details based on role (only if needed)
    const roleModelMap = {
      employer: Employer,
      student: Student,
      admin: Admin,
      content: ContentManager
    };

    const Model = roleModelMap[baseUser.role];
    const additionalDetails = Model 
      ? await Model.findOne({ userId: req.user.id }).lean() 
      : null;

    return res.status(200).json({
      user: {
        ...baseUser,
        details: additionalDetails || null,
      },
    });

  } catch (error) {
    console.error("Error fetching user details:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};



const registerAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if admin already exists
    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Admin with this email already exists." });
    }

    // Hash password and create user/admin in parallel
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    
    const newUser = await User.create({
      name: "ADMIN",
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      isEmailVerified: true,
      isVerified: true,
    });

    // Create admin profile asynchronously (non-blocking)
    setImmediate(() => {
      Admin.create({ userId: newUser._id, fullName: "ADMIN" }).catch(err => {
        console.error('Failed to create admin profile:', err.message);
      });
    });

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully.",
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Admin with this email already exists." });
    }
    console.error("Error in registerAdmin:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const adminSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // Fetch admin user with password
    const adminUser = await User.findOne({ email: normalizedEmail, role: "admin" })
      .select("+password")
      .select("_id role email isEmailVerified isVerified")
      .lean();

    if (!adminUser) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    if (!adminUser.isEmailVerified || !adminUser.isVerified) {
      return res.status(403).json({ success: false, message: "Account not verified. Please contact support." });
    }

    if (!(await bcrypt.compare(password, adminUser.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Fetch admin details
    const adminDetails = await Admin.findOne({ userId: adminUser._id })
      .select('fullName isActive')
      .lean();

    if (!adminDetails) {
      return res.status(404).json({ success: false, message: "Admin profile not found." });
    }

    if (!adminDetails.isActive) {
      return res.status(403).json({ success: false, message: "Admin account is deactivated. Please contact support." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Admin signed in successfully.",
      token,
      user: {
        id: adminUser._id,
        name: adminDetails.fullName || "ADMIN",
        email: adminUser.email,
        role: adminUser.role,
      },
    });

  } catch (error) {
    console.error("Error in adminSignIn:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



const registerContent = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if content manager already exists
    const existingUser = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Content manager with this email already exists." });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    
    const newUser = await User.create({
      name: "Content-Manager",
      email: normalizedEmail,
      password: hashedPassword,
      role: "content",
      isEmailVerified: true,
      isVerified: true,
    });

    // Create content manager profile asynchronously (non-blocking)
    setImmediate(() => {
      ContentManager.create({ userId: newUser._id, fullName: "Content-Manager" }).catch(err => {
        console.error('Failed to create content manager profile:', err.message);
      });
    });

    return res.status(201).json({
      success: true,
      message: "ContentManager registered successfully.",
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Content manager with this email already exists." });
    }
    console.error("Error in registerContent:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const contentManagerSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // Fetch content manager user with password
    const contentUser = await User.findOne({ email: normalizedEmail, role: "content" })
      .select("+password")
      .select("_id role email isEmailVerified isVerified")
      .lean();

    if (!contentUser) {
      return res.status(404).json({ success: false, message: "ContentManager not found." });
    }

    if (!contentUser.isEmailVerified || !contentUser.isVerified) {
      return res.status(403).json({ success: false, message: "Account not verified. Please contact support." });
    }

    if (!(await bcrypt.compare(password, contentUser.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // Fetch content manager details
    const contentDetails = await ContentManager.findOne({ userId: contentUser._id })
      .select('fullName isActive')
      .lean();

    if (!contentDetails) {
      return res.status(404).json({ success: false, message: "ContentManager profile not found." });
    }

    if (!contentDetails.isActive) {
      return res.status(403).json({ success: false, message: "Account is deactivated. Please contact support." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: contentUser._id, role: contentUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "ContentManager signed in successfully.",
      token,
      user: {
        id: contentUser._id,
        name: contentDetails.fullName || "Content-Manager",
        email: contentUser.email,
        role: contentUser.role,
      },
    });

  } catch (error) {
    console.error("Error in contentManagerSignIn:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// ==================== MOBILE AUTHENTICATION ====================

// 📱 LOGIN: Send OTP to mobile (Login - Mobile only)
const sendLoginOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
    }

    const user = await User.findOne({ mobile }).select('isVerified').lean();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this mobile number. Please sign up first." 
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: "Account not verified. Please complete signup process." 
      });
    }

    // Generate OTP and update in single operation
    const { otp, otpExpires } = generateOtpWithExpiration(10);
    await User.updateOne(
      { mobile },
      { $set: { otp, otpExpires } }
    );

    // Send SMS asynchronously (non-blocking)
    setImmediate(() => {
      sendOtpSms(mobile, otp).catch(err => {
        console.error(`Failed to send SMS to ${mobile}:`, err.message);
      });
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number.",
    });

  } catch (error) {
    console.error("Error in sendLoginOtp:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// 📱 LOGIN: Verify OTP and login
const verifyLoginOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: "Mobile number and OTP are required." });
    }

    const user = await User.findOne({ mobile })
      .select('_id role name email mobile isProfileVerified otp otpExpires')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // Clear OTP and update mobile verified in single operation
    await User.updateOne(
      { mobile },
      { 
        $set: { isMobileVerified: true },
        $unset: { otp: "", otpExpires: "" }
      }
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        name: user.name, 
        isProfileVerified: user.isProfileVerified 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        isProfileVerified: user.isProfileVerified
      }
    });

  } catch (error) {
    console.error("Error in verifyLoginOtp:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// 📱 SIGNUP: Send OTP to mobile (Signup - Name, Email, Mobile)
const sendSignupOtp = async (req, res) => {
  try {
    const { name, email, mobile, role } = req.body;

    if (!name || !email || !mobile) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, and mobile number are required." 
      });
    }

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid 10-digit mobile number." 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid email address." 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const sanitizedName = name.trim();

    // Check existing users in parallel
    const [existingEmailUser, existingMobileUser] = await Promise.all([
      User.findOne({ email: normalizedEmail }).select('isVerified').lean(),
      User.findOne({ mobile }).select('isVerified').lean()
    ]);

    if (existingEmailUser?.isVerified || existingMobileUser?.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: "An account with this email or mobile number already exists." 
      });
    }

    // Generate OTP
    const { otp, otpExpires } = generateOtpWithExpiration(10);

    if (existingEmailUser || existingMobileUser) {
      // Update existing unverified user
      const userId = existingEmailUser?._id || existingMobileUser?._id;
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            name: sanitizedName,
            email: normalizedEmail,
            mobile,
            role: role || "student",
            otp,
            otpExpires
          }
        }
      );
    } else {
      // Create new user
      await User.create({
        name: sanitizedName,
        email: normalizedEmail,
        mobile,
        role: role || "student",
        password: null,
        otp,
        otpExpires
      });
    }

    // Send SMS asynchronously (non-blocking)
    setImmediate(() => {
      sendOtpSms(mobile, otp).catch(err => {
        console.error(`Failed to send SMS to ${mobile}:`, err.message);
      });
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number.",
    });

  } catch (error) {
    console.error("Error in sendSignupOtp:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// 📱 SIGNUP: Verify OTP and create account
const verifySignupOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    if (!mobile || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Mobile number and OTP are required." 
      });
    }

    const user = await User.findOne({ mobile })
      .select('_id role name email mobile isProfileVerified otp otpExpires')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP has expired. Please request a new one." 
      });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // Update user verification and create student profile in parallel
    const updatePromise = User.updateOne(
      { mobile },
      {
        $set: { isEmailVerified: true, isVerified: true, isMobileVerified: true },
        $unset: { otp: "", otpExpires: "" }
      }
    );

    let studentPromise = Promise.resolve();
    if (user.role === "student") {
      studentPromise = Student.findOneAndUpdate(
        { userId: user._id },
        { userId: user._id },
        { upsert: true, new: true }
      );
    }

    await Promise.all([updatePromise, studentPromise]);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        name: user.name, 
        isProfileVerified: user.isProfileVerified 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Account created successfully!",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        isProfileVerified: user.isProfileVerified
      }
    });

  } catch (error) {
    console.error("Error in verifySignupOtp:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
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

  registerAdmin,
  adminSignIn,

  registerContent,
  contentManagerSignIn,
  resendOtp,

  // Mobile Authentication
  sendLoginOtp,
  verifyLoginOtp,
  sendSignupOtp,
  verifySignupOtp
}