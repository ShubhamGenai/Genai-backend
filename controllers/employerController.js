const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const express = require("express");
const sendAdminNotification = require("../utils/sendAdminNotification");
const Employer = require("../models/EmployerModel");
const Whitelist = require("../models/WhiteListDomain");
const User = require("../models/UserModel");
const adminNotificationModel = require("../models/adminNotificationModel");
dotenv.config();



const validCompanies = async (req, res) => {
    try {
      const validCompanies = await Whitelist.find({ approved: true });
      res.json(validCompanies.map((company) => company.domain));
    } catch (error) {
      res.status(500).json({ message: "Error fetching company list" });
    }
  }



 const employerEmailVerify = async (req, res) => {
  try {
    const { email } = req.body;

    // ✅ Validate Input
    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // ✅ Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // ❌ If user doesn't exist, create new user with role "employer"
      user = new User({
        email: email.toLowerCase(),
        role: "employer",
        isEmailVerified: false, // Will be verified later
        isProfileVerified: false,
      });

      await user.save();
    }

    // ✅ Check if employer profile exists
    let employer = await Employer.findOne({ userId: user._id });

    if (employer) {
      if (employer.isDomainVerified) {
        return res.status(400).json({ message: "Employer already verified." });
      }


      await user.save();
      // If employer exists but is NOT verified, continue process
    }

    // ✅ Check if domain is in whitelist
    let company = await Whitelist.findOne({ domain });

    if (!company) {
      // ❌ If domain is NOT found, create an unapproved entry
      company = new Whitelist({ domain, approved: false });
      await company.save();

      // 🔹 Notify admin only if no notification exists for this domain
      const existingNotification = await adminNotificationModel.findOne({ message: `New unapproved domain added: ${domain}` });

      if (!existingNotification) {
        await sendAdminNotification("info", `New unapproved domain added: ${domain}`);
      }

      return res.status(400).json({
        message: "Your company domain is not approved yet. Admin has been notified.",
      });
    }

    // ❌ If domain exists but is NOT approved, block registration
    if (!company.approved) {
      return res.status(400).json({
        message: "Your company domain is not approved yet. Please wait for admin approval.",
      });
    }

    // ✅ Save or update employer profile
    if (employer) {
      employer.isDomainVerified = true;
      await employer.save();
    } else {
      const newEmployer = new Employer({
        userId: user._id,
        email: email.toLowerCase(),
        domain,
        isDomainVerified: true,
      });
      await newEmployer.save();
    }

    return res.status(200).json({ message: "Employer email verification successful!" });

  } catch (error) {
    console.error("❌ Error in employerEmailVerify:", error);
    return res.status(500).json({ message: "Error processing request", error: error.message });
  }
};

  
  

  


const employerRegistration = async (req, res) => {
  try {
    const { email, password, companyName } = req.body;

    // ✅ Validate Input
    if (!email || !password || !companyName) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // ✅ Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // ❌ If user doesn't exist, create new user with role "employer"
      const hashedPassword = await bcrypt.hash(password, 10);

      user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "employer",
        isEmailVerified: true, // Email is verified in previous step
        isProfileVerified: true,
      });

      await user.save();
    } else {
      // 🔄 Update existing user password if needed
      if (password) {
        user.password = await bcrypt.hash(password, 10);
        user.isVerified = true; // ✅ Ensure user is verified
        user.isEmailVerified = true;
       
        await user.save();
      }
    }

    // ✅ Check if employer profile exists
    let employer = await Employer.findOne({ userId: user._id });

    if (employer) {
      // 🔄 Update employer details
      employer.companyName = companyName;
      employer.isDomainVerified = true;

      await employer.save();
      return res.status(200).json({ message: "Employer details updated successfully." });
    }

    // ✅ Create a new Employer profile
    const newEmployer = new Employer({
      userId: user._id,
      companyName,
      domain,
      isDomainVerified: true,
    });

    await newEmployer.save();

    return res.status(201).json({ message: "Employer registration successful." });

  } catch (error) {
    console.error("❌ Error in employerRegistration:", error);
    return res.status(500).json({ message: "Error processing request", error: error.message });
  }
};


const employerSignin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // ✅ Find the user in the User collection
    const user = await User.findOne({ email });

    if (!user || user.role !== "employer") {
      return res.status(404).json({ message: "User not found. Please register first." });
    }

    // ✅ Verify email and admin approval
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: "Your email is not verified. Please verify it first." });
    }

    // if (!user.isProfileVerified) {
    //   return res.status(403).json({ message: "Your account is pending admin approval." });
    // }

    // ✅ Check if the employer profile exists
    const employer = await Employer.findOne({ userId: user._id });

    if (!employer) {
      return res.status(404).json({ message: "Employer profile not found. Please complete your registration." });
    }

    if (!employer.isDomainVerified) {
      return res.status(403).json({ message: "Your company domain is pending approval." });
    }

    // ✅ Check if domain is whitelisted
    const domainData = await Whitelist.findOne({ domain });

    if (!domainData || !domainData.approved) {
      return res.status(403).json({ message: "Your company domain is not whitelisted." });
    }

    // ✅ Compare password securely
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // ✅ Generate JWT Token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, companyName: employer.companyName },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Successful login response
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: { email: user.email, companyName: employer.companyName ,role: user.role},
    });

  } catch (error) {
    console.error("❌ Error in employerSignin:", error);
    return res.status(500).json({ message: "Server error. Please try again later.", error: error.message });
  }
};


    module.exports = {
        
        employerEmailVerify,
        employerRegistration,
        validCompanies,
        employerSignin
    }