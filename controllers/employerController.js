const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const express = require("express");

const sendAdminNotification = require("../utils/SendAdminNotification");
const { Employer, Whitelist } = require("../models/EmployerModel");

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
    console.log("Incoming request body:", req.body);

    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    const domain = email.split("@")[1];

    try {
     

        // Check if employer email already exists
        let existingEmployer = await Employer.findOne({ email });
        if (existingEmployer) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Check if domain is in whitelist
        let company = await Whitelist.findOne({ domain });

        if (!company) {
            await sendAdminNotification("info", `Unapproved Domain: ${domain}`);
            return res.status(400).json({
                message: "Your company domain is not whitelisted. Admin has been notified.",
            });
        }

        if (!company.approved) {
            return res.status(403).json({ message: "Your company domain is pending approval." });
        }

        // ✅ Save employer email in the database
        const newEmployer = new Employer({ email });
        await newEmployer.save();

        res.status(201).json({ message: "Email saved successfully" });

    } catch (error) {
        console.error("Error in employerEmailVerify:", error); // Log error details
        res.status(500).json({ message: "Error processing request", error: error.message });
    }
};


  



const employerRegistration = async (req, res) => {
  const { email, password, companyName } = req.body;

  try {
    // Check if employer exists
    let employer = await Employer.findOne({ email });

    if (!employer) {
      return res.status(404).json({ message: "Employer not found. Please verify your email first." });
    }

    // Hash the new password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update employer details
    employer.password = hashedPassword;
    employer.companyName = companyName;
    employer.isVerified = true; // Mark as verified after completing registration

    await employer.save();

    res.status(200).json({ message: "Registration completed successfully" });
  } catch (error) {
    console.error("Error in employer registration:", error);
    res.status(500).json({ message: "Error registering employer" });
  }
};

    module.exports = {
        
        employerEmailVerify,
        employerRegistration,
        validCompanies,
    }