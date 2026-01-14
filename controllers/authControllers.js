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
  const startTime = Date.now();
  console.log('🔵 [REGISTER] Request received:', {
    body: { fullName: req.body?.fullName, email: req.body?.email, hasPassword: !!req.body?.password },
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString()
  });

  try {
    const { fullName, email, password } = req.body;

    // ✅ Input validation and sanitization
    if (!fullName || !email || !password) {
      console.log('❌ [REGISTER] Missing required fields:', { fullName: !!fullName, email: !!email, password: !!password });
      return res.status(400).json({ 
        success: false, 
        message: "Name, Email, and Password are required." 
      });
    }

    // Sanitize and normalize inputs
    const sanitizedName = fullName.trim();
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedPassword = password.trim();

    console.log('🔍 [REGISTER] Input sanitized:', {
      originalName: fullName,
      sanitizedName,
      originalEmail: email,
      normalizedEmail,
      passwordLength: trimmedPassword.length
    });

    // Validate name length (2-50 characters)
    if (sanitizedName.length < 2 || sanitizedName.length > 50) {
      console.log('❌ [REGISTER] Invalid name length:', { length: sanitizedName.length });
      return res.status(400).json({ 
        success: false, 
        message: "Name must be between 2 and 50 characters." 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      console.log('❌ [REGISTER] Invalid email format:', { email: normalizedEmail });
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid email address." 
      });
    }

    // Validate password strength (minimum 6 characters, at least one letter and one number)
    if (trimmedPassword.length < 6) {
      console.log('❌ [REGISTER] Password too short:', { length: trimmedPassword.length });
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters long." 
      });
    }

    console.log('✅ [REGISTER] Input validation passed');

    // ✅ Check if user already exists (single database query)
    console.log('🔍 [REGISTER] Checking if user exists:', { email: normalizedEmail });
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();

    if (existingUser) {
      console.log('👤 [REGISTER] User found:', {
        email: normalizedEmail,
        isEmailVerified: existingUser.isEmailVerified,
        isVerified: existingUser.isVerified,
        isProfileVerified: existingUser.isProfileVerified,
        hasOtp: !!existingUser.otp
      });

      // If user is already registered/verified, show error
      if (existingUser.isEmailVerified || existingUser.isVerified || existingUser.isProfileVerified) {
        console.log('❌ [REGISTER] User already verified - registration blocked');
        return res.status(400).json({ 
          success: false, 
          message: "Email already exists. Please login instead." 
        });
      }

      // ✅ User exists but NOT verified - return error (use resend OTP instead)
      console.log('❌ [REGISTER] User exists but not verified - registration blocked. Use resend OTP instead.');
      const duration = Date.now() - startTime;
      console.log(`❌ [REGISTER] Registration blocked (existing unverified user) in ${duration}ms`);

      return res.status(400).json({ 
        success: false, 
        message: "Email already exists. Please use 'Resend OTP' if you haven't received the verification code." 
      });
    }

    console.log('🆕 [REGISTER] Creating new user...');

    // ✅ Create new user - hash password and generate OTP
    const { otp: newOtp, otpExpires } = generateOtpWithExpiration(10);
    console.log('🔐 [REGISTER] Generated OTP:', { otp: newOtp, expires: otpExpires.toISOString() });
    
    console.log('🔐 [REGISTER] Hashing password...');
    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    // Create user document
    const newUser = new User({
      name: sanitizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: "student",
      otp: newOtp,
      otpExpires: otpExpires,
    });

    console.log('💾 [REGISTER] Saving new user to database...');
    // Save user to database
    await newUser.save();
    console.log('✅ [REGISTER] New user saved:', {
      userId: newUser._id,
      email: normalizedEmail,
      name: sanitizedName,
      otp: newOtp,
      otpExpires: otpExpires.toISOString()
    });

    // Send email asynchronously in background (non-blocking)
    setImmediate(async () => {
      try {
        console.log('📧 [REGISTER] Sending OTP email in background...');
        await sendOtpEmail(normalizedEmail, newOtp);
        console.log('✅ [REGISTER] OTP email sent successfully');
      } catch (emailError) {
        console.error(`❌ [REGISTER] Failed to send OTP email to: ${normalizedEmail}`, {
          error: emailError.message,
          stack: emailError.stack
        });
      }
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [REGISTER] Registration completed (new user) in ${duration}ms`);

    // Return response immediately without waiting for email
    return res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email using the OTP sent.",
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [REGISTER] Error occurred after ${duration}ms:`, {
      error: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      console.log('❌ [REGISTER] Duplicate key error (email already exists)');
      return res.status(400).json({ 
        success: false, 
        message: "Email already exists. Please login instead." 
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      console.log('❌ [REGISTER] Validation error:', error.errors);
      return res.status(400).json({ 
        success: false, 
        message: error.message || "Validation error. Please check your input." 
      });
    }

    // Generic error handling
    return res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again later." 
    });
  }
};





const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // ✅ Validate input
    if (!email || !otp) {
    
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    // ✅ Find user by email
    const user = await User.findOne({ email });

    if (!user) {
     
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // ✅ Check OTP expiration
    if (!user.otp || user.otpExpires < Date.now()) {
    
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    // ✅ Verify OTP
    if (user.otp !== otp) {
      
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // ✅ Mark user as verified
    user.isEmailVerified = true;
    user.isVerified = true;
    user.otp = null; // Clear OTP
    user.otpExpires = null;

    await user.save();
 

    // ✅ If role is "student", create a student profile if not exists
    if (user.role === "student") {
      const existingStudent = await Student.findOne({ userId: user._id });

      if (!existingStudent) {
        const newStudent = new Student({ userId: user._id });
        await newStudent.save();
       
      }
    }

    return res.status(200).json({ success: true, message: "OTP verified successfully!" });

  } catch (error) {
   
    return res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Generate a new OTP
    const { otp: newOtp, otpExpires } = generateOtpWithExpiration(10);
    user.otp = newOtp;
    user.otpExpires = otpExpires; // OTP valid for 10 minutes

    // Save the OTP to database first
    await user.save();
    console.log(`✅ New OTP saved to database for user: ${email}, OTP: ${newOtp}`);

    // Send email asynchronously in background (non-blocking)
    setImmediate(async () => {
      try {
        await sendOtpEmail(email, newOtp);
        console.log(`✅ OTP email sent to: ${email}, OTP: ${newOtp}`);
      } catch (emailError) {
        console.error(`❌ Failed to send OTP email to: ${email}`, emailError);
      }
    });

    // Return response immediately without waiting for email
    return res.status(200).json({ success: true, message: "New OTP sent successfully!" });
  } catch (error) {
    console.error("Error in resendOtp:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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

      if (user.role !== "student") {
        return { status: 403, message: "Please verify your account No student registered with this email" };
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
        user: { 
          id: user._id, 
          username: user.username, 
          email: user.email, 
          role: user.role, 
          name: user.name,
          onboardingCompleted: user.onboardingCompleted || false
        },
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
    const otp = generateOtp(); // Random 6-digit OTP as string

    // Save OTP to user's account
    user.otp = otp; // Store OTP as a string
    await user.save();
    console.log(`✅ OTP saved to database for password reset: ${email}, OTP: ${otp}`);

    // Send email asynchronously in background (non-blocking)
    setImmediate(async () => {
      try {
        await sendOtpEmail(email, otp);
        console.log(`✅ OTP email sent for password reset: ${email}, OTP: ${otp}`);
      } catch (emailError) {
        console.error(`❌ Failed to send OTP email for password reset: ${email}`, emailError);
      }
    });

    // Return response immediately without waiting for email
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


// ==================== STUDENT LEARNING GOAL & PREFERENCES ====================

/**
 * Save / update learning goal and preferences for the logged‑in user.
 * This is used by the student dashboard onboarding popup (NEET / JEE / Technical / Non‑technical etc.).
 */
const saveLearningPreferences = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. User not found in request.",
      });
    }

    const {
      learningGoal,
      examPreference,
      preferredSections,
      studyPreference,
    } = req.body || {};

    // Basic validation – we at least expect a primary goal
    if (!learningGoal) {
      return res.status(400).json({
        success: false,
        message: "Learning goal is required.",
      });
    }

    const updatePayload = {
      learningGoal,
      onboardingCompleted: true,
    };

    if (typeof examPreference === "string") {
      updatePayload.examPreference = examPreference;
    }

    if (Array.isArray(preferredSections)) {
      updatePayload.preferredSections = preferredSections;
    }

    if (typeof studyPreference === "string") {
      updatePayload.studyPreference = studyPreference;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updatePayload, {
      new: true,
    }).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Learning preferences updated successfully.",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        isProfileVerified: updatedUser.isProfileVerified,
        learningGoal: updatedUser.learningGoal,
        examPreference: updatedUser.examPreference,
        preferredSections: updatedUser.preferredSections || [],
        studyPreference: updatedUser.studyPreference,
        onboardingCompleted: updatedUser.onboardingCompleted,
      },
    });
  } catch (error) {
    console.error("Error in saveLearningPreferences:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
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
// const googlelogin = (req, res, next) => {
//   passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
// };


const googlelogin = async (req, res) => {
  try {
    const { name, email, firebaseUid } = req.body;

    // ✅ Validate input
    if (!name || !email || !firebaseUid) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, and Firebase UID are required." 
      });
    }

    // ✅ Verify Firebase UID (uncomment when Firebase is properly configured)
    // const userRecord = await admin.auth().getUser(firebaseUid).catch(() => null);
    // if (!userRecord) {
    //   return res.status(401).json({ 
    //     success: false, 
    //     message: "Invalid Firebase UID" 
    //   });
    // }

    // ✅ Find or create user
    let user = await User.findOne({ email });
    
    if (!user) {
      // Create new user
      user = new User({
        name: name,
        email,
        googleId: firebaseUid,
        password: null, // No password needed for Google auth
        isEmailVerified: true,
        isVerified: true,
        role:"student",
      });
      await user.save();

      // ✅ Create student profile for new users
      const newStudent = new Student({ userId: user._id });
      await newStudent.save();
    } else {
      // Update existing user with Google ID if not set
      if (!user.googleId) {
        user.googleId = firebaseUid;
        user.isEmailVerified = true;
        user.isVerified = true;
        await user.save();
      }
    }

    // ✅ Generate JWT token (consistent with other auth functions)
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

    // ✅ Return consistent response format
    return res.status(200).json({
      success: true,
      message: "Google login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isProfileVerified: user.isProfileVerified,
        onboardingCompleted: user.onboardingCompleted || false
      }
    });

  } catch (error) {
    console.error("Google login error:", error);
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
    console.log("Fetching user details...");

    // 🔹 Fetch base user data
    const baseUser = await User.findById(req.user.id).select("-password -__v").lean();
    if (!baseUser) {
      return res.status(404).json({ message: "User not found" });
    }

    let additionalDetails = {};

    // 🔹 Fetch additional details based on user role
    if (baseUser.role === "employer") {
      additionalDetails = await Employer.findOne({ userId: req.user.id }).lean();
    } else if (baseUser.role === "student") {
      additionalDetails = await Student.findOne({ userId: req.user.id }).lean();
    }
    else if (baseUser.role === "admin") {
      additionalDetails = await Admin.findOne({ userId: req.user.id }).lean();
    } else if (baseUser.role === "content") {
      additionalDetails = await ContentManager.findOne({ userId: req.user.id }).lean();
    }


    res.status(200).json({
      user: {
        ...baseUser, // 🔹 Includes email, role, etc.
        details: additionalDetails || null, // 🔹 Includes employer/student-specific details
      },
    });

  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



const registerAdmin = async (req, res) => {
 
  
  try {
    const {  email, password } = req.body;

    // ✅ Validate input
    if (  !email || !password) {
      return res.status(400).json({ success: false, message: " Email, and Password are required." });
    }

    // ✅ Check if the admin (user) already exists
    let existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Admin with this email already exists." });
    }

    // ✅ Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create User entry (linked to Admin)
    const newUser = new User({
      name: "ADMIN",
      email,
      password: hashedPassword,
      role: "admin",
      isEmailVerified: true,
      isVerified: true, // Directly setting email as verified since no OTP is used
    });

    await newUser.save();

    // ✅ Create Admin entry
    const newAdmin = new Admin({
      userId: newUser._id,
      fullName:"ADMIN",
     
    });

    await newAdmin.save();

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully.",
    });

  } catch (error) {
    console.error("Error in registerAdmin:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


const adminSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Validate Input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }

    // ✅ Ensure valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // ✅ Check if Admin Exists
    const adminUser = await User.findOne({ email, role: "admin" });
    if (!adminUser) {
      return res.status(404).json({ success: false, message: "Admin not found." });
    }

    // ✅ Ensure Email is Verified
    if (!adminUser.isEmailVerified) {
      return res.status(403).json({ success: false, message: "Email is not verified. Please verify your email before signing in." });
    }

    // ✅ Ensure Profile is Verified
    if (!adminUser.isVerified) {
      return res.status(403).json({ success: false, message: "Not verified. Please contact support." });
    }

    // ✅ Compare Password
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // ✅ Fetch Admin Details
    const adminDetails = await Admin.findOne({ userId: adminUser._id });
    if (!adminDetails) {
      return res.status(404).json({ success: false, message: "Admin profile not found." });
    }

    // ✅ Check if Admin is Active
    if (!adminDetails.isActive) {
      return res.status(403).json({ success: false, message: "Admin account is deactivated. Please contact support." });
    }

    // ✅ Generate JWT Token
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
        name: adminDetails?.fullName||{},
        email: adminUser.email,
        role: adminUser.role,
     
      },
    });

  } catch (error) {
    console.error("Error in adminSignIn:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};



const registerContent = async (req, res) => {
 
  
  try {
    const {  email, password } = req.body;

    // ✅ Validate input
    if (  !email || !password) {
      return res.status(400).json({ success: false, message: " Email, and Password are required." });
    }

    // ✅ Check if the admin (user) already exists
    let existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Content manager with this email already exists." });
    }

    // ✅ Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create User entry (linked to Admin)
    const newUser = new User({
      name: "Content-Manager",
      email,
      password: hashedPassword,
      role: "content",
      isEmailVerified: true,
      isVerified: true, // Directly setting email as verified since no OTP is used
    });

    await newUser.save();

    // ✅ Create Admin entry
    const newContentManager = new ContentManager({
      userId: newUser._id,
      fullName:"Content-Manager",
     
    });

    await newContentManager.save();

    return res.status(201).json({
      success: true,
      message: "ContentManager registered successfully.",
    });

  } catch (error) {
    console.error("Error in register:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


const contentManagerSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Validate Input
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and Password are required." });
    }

    // ✅ Ensure valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format." });
    }

    // ✅ Check if Admin Exists
    const adminUser = await User.findOne({ email, role: "content" });
    if (!adminUser) {
      return res.status(404).json({ success: false, message: "ContentManager not found." });
    }

    // ✅ Ensure Email is Verified
    if (!adminUser.isEmailVerified) {
      return res.status(403).json({ success: false, message: "Email is not verified. Please verify your email before signing in." });
    }

    // ✅ Ensure Profile is Verified
    if (!adminUser.isVerified) {
      return res.status(403).json({ success: false, message: "Not verified. Please contact support." });
    }

    // ✅ Compare Password
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }

    // ✅ Fetch Admin Details
    const adminDetails = await ContentManager.findOne({ userId: adminUser._id });
    if (!adminDetails) {
      return res.status(404).json({ success: false, message: "ContentManager profile not found." });
    }

    // ✅ Check if Admin is Active
    if (!adminDetails.isActive) {
      return res.status(403).json({ success: false, message: "Admin account is deactivated. Please contact support." });
    }

    // ✅ Generate JWT Token
    const token = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
   

    return res.status(200).json({
      success: true,
      message: "ContentManager signed in successfully.",
      token,
      user: {
        id: adminUser._id,
        name: adminDetails?.fullName||{},
        email: adminUser.email,
        role: adminUser.role,
     
      },
    });

  } catch (error) {
    console.error("Error in adminSignIn:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// ==================== MOBILE AUTHENTICATION ====================

// 📱 LOGIN: Send OTP to mobile (Login - Mobile only)
const sendLoginOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    // ✅ Validate input
    if (!mobile) {
      return res.status(400).json({ success: false, message: "Mobile number is required." });
    }

    // ✅ Validate mobile number format (10 digits)
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Please enter a valid 10-digit mobile number." });
    }

    // ✅ Check if user exists with this mobile number
    let user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "No account found with this mobile number. Please sign up first." 
      });
    }

    // ✅ Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        success: false, 
        message: "Account not verified. Please complete signup process." 
      });
    }

    // ✅ Generate new OTP
    const { otp, otpExpires } = generateOtpWithExpiration(10);
    user.otp = otp;
    user.otpExpires = otpExpires; // 10 minutes

    await user.save();

    // ✅ Send OTP via SMS
    try {
      await sendOtpSms(mobile, user.otp);
    } catch (smsError) {
      console.error("SMS sending failed:", smsError);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send OTP. Please try again later." 
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number.",
    });

  } catch (error) {
    console.error("Error in sendLoginOtp:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 📱 LOGIN: Verify OTP and login
const verifyLoginOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // ✅ Validate input
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: "Mobile number and OTP are required." });
    }

    // ✅ Find user by mobile
    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // ✅ Check OTP expiration
    if (!user.otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    // ✅ Verify OTP
    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // ✅ Clear OTP
    user.otp = null;
    user.otpExpires = null;
    user.isMobileVerified = true;

    await user.save();

    // ✅ Generate JWT token
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
        isProfileVerified: user.isProfileVerified,
        onboardingCompleted: user.onboardingCompleted || false
      }
    });

  } catch (error) {
    console.error("Error in verifyLoginOtp:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 📱 SIGNUP: Send OTP to mobile (Signup - Name, Email, Mobile)
const sendSignupOtp = async (req, res) => {
  try {
    const { name, email, mobile, role } = req.body;

    // ✅ Validate input
    if (!name || !email || !mobile) {
      return res.status(400).json({ 
        success: false, 
        message: "Name, email, and mobile number are required." 
      });
    }

    // ✅ Validate mobile number format (10 digits)
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid 10-digit mobile number." 
      });
    }

    // ✅ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please enter a valid email address." 
      });
    }

    // ✅ Check if user already exists with email
    let existingEmailUser = await User.findOne({ email });
    if (existingEmailUser && existingEmailUser.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: "An account with this email already exists." 
      });
    }

    // ✅ Check if user already exists with mobile
    let existingMobileUser = await User.findOne({ mobile });
    if (existingMobileUser && existingMobileUser.isVerified) {
      return res.status(400).json({ 
        success: false, 
        message: "An account with this mobile number already exists." 
      });
    }

    let user;

    if (existingEmailUser || existingMobileUser) {
      // ✅ Update existing unverified user
      user = existingEmailUser || existingMobileUser;
      user.name = name;
      user.email = email;
      user.mobile = mobile;
      user.role = role || "student";
    } else {
      // ✅ Create new user
      user = new User({
        name,
        email,
        mobile,
        role: role || "student",
        password: null, // No password for mobile signup
      });
    }

    // ✅ Generate OTP
    const { otp, otpExpires } = generateOtpWithExpiration(10);
    user.otp = otp;
    user.otpExpires = otpExpires; // 10 minutes

    await user.save();

    // ✅ Send OTP via SMS
    try {
      await sendOtpSms(mobile, user.otp);
    } catch (smsError) {
      console.error("SMS sending failed:", smsError);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send OTP. Please try again later." 
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number.",
    });

  } catch (error) {
    console.error("Error in sendSignupOtp:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// 📱 SIGNUP: Verify OTP and create account
const verifySignupOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // ✅ Validate input
    if (!mobile || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: "Mobile number and OTP are required." 
      });
    }

    // ✅ Find user by mobile
    const user = await User.findOne({ mobile });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // ✅ Check OTP expiration
    if (!user.otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        message: "OTP has expired. Please request a new one." 
      });
    }

    // ✅ Verify OTP
    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
    }

    // ✅ Mark user as verified
    user.isEmailVerified = true;
    user.isVerified = true;
    user.isMobileVerified = true;
    user.otp = null;
    user.otpExpires = null;

    await user.save();

    // ✅ If role is "student", create a student profile if not exists
    if (user.role === "student") {
      const existingStudent = await Student.findOne({ userId: user._id });

      if (!existingStudent) {
        const newStudent = new Student({ userId: user._id });
        await newStudent.save();
      }
    }

    // ✅ Generate JWT token
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
    console.error("Error in verifySignupOtp:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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
  verifySignupOtp,

  // Learning goal & preferences
  saveLearningPreferences,
}