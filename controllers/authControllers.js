const User = require("../models/UserModel");
const Student = require("../models/studentSchema")
const { sendOtpEmail } = require('../utils/emailOTP');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config();

require('../config/passport');
const passport = require('passport');
const { OAuth2Client } = require('google-auth-library');
const Employer = require("../models/EmployerModel");
const Admin = require("../models/AdminModel");
const client = new OAuth2Client(process.env.CLIENTID);



const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // ✅ Validate input
    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, Email, and Password are required." });
    }

    // ✅ Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      if (user.isProfileVerified) {
        return res.status(400).json({ success: false, message: "User already exists and is verified." });
      }

      // ✅ Update details for unverified users
      user.name = fullName;
      user.password = await bcrypt.hash(password, 10);
      user.role = "student";

      // ✅ Generate new OTP
      user.otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      await Promise.all([user.save(), sendOtpEmail(email, user.otp)]);

      return res.status(200).json({
        success: true,
        message: "User information updated. A new OTP has been sent to your email. Please verify your account.",
      });
    }

    // ✅ Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create a new user
    const newUser = new User({
      name: fullName,
      email,
      password: hashedPassword,
      role: "student",
      otp: Math.floor(100000 + Math.random() * 900000).toString(),
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
    });

    await newUser.save();

    // ✅ Send OTP Email
    await sendOtpEmail(email, newUser.otp);

    return res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email using the OTP sent.",
    });

  } catch (error) {
    console.error("Error in registerStudent:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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
  console.log(req.body);
  
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





}