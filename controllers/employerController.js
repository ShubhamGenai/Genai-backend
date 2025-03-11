const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const express = require("express");
const { Employer, Whitelist } = require("../models/EmployerModel");
const  {Notification} = require("../models/adminNotificationModel");
const sendAdminNotification = require("../utils/sendAdminNotification")
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
    const { email } = req.body;
  
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
  
    const domain = email.split("@")[1];
  
    try {
      // 🔹 Check if employer email already exists
      let existingEmployer = await Employer.findOne({ email });
  
      if (existingEmployer) {
        if (existingEmployer.isVerified) {
          return res.status(400).json({ message: "User already exists" }); // ❌ Block verified users
        }
        // If user exists but is NOT verified, continue the process
      }
  
      // 🔹 Check if domain is in whitelist
      let company = await Whitelist.findOne({ domain });
  
      if (!company) {
        // ❌ If domain is NOT found, create an unapproved entry
        company = new Whitelist({ domain, approved: false,  }); // Added verified field
        await company.save();
  
        // 🔹 Check if a notification for this domain already exists
        let existingNotification = await Notification.findOne({ message: `New unapproved domain added: ${domain}` });
  
        if (existingNotification) {
          // 🔄 Update existing notification timestamp
          await Notification.updateOne(
            { message: `New unapproved domain added: ${domain}` },
            { $set: { createdAt: Date.now(), status: "unread" } }
          );
        } else {
          // ✅ Create a new notification
          await sendAdminNotification("info", `New unapproved domain added: ${domain}`);
        }
  
        return res.status(400).json({
          message: "Your company domain is not approved yet. Admin has been notified.",
        });
      }
  
      // ❌ If domain exists but is NOT approved, block registration and notify admin
      if (!company.approved) {
        return res.status(400).json({
          message: "Your company domain is not approved yet. Please wait for admin approval.",
        });
      }
  
      // ✅ Save employer email in the database (either new or updating an unverified one)
      if (existingEmployer) {
        // existingEmployer.isVerified = true;
        await existingEmployer.save();
      } else {
        const newEmployer = new Employer({ email});
        await newEmployer.save();
      }
  
      res.status(200).json({ message: "Email verification successful" });
  
    } catch (error) {
      console.error("Error in employerEmailVerify:", error);
      res.status(500).json({ message: "Error processing request", error: error.message });
    }
  };
  
  

  


const employerRegistration = async (req, res) => {
  try {
      

      const { email, password, companyName } = req.body;

      if (!email || !password || !companyName) {
         
          return res.status(400).json({ message: "All fields are required" });
      }

  
      let employer = await Employer.findOne({ email });

      if (employer) {
        
          employer.password = password;
          employer.companyName = companyName;
          employer.isVerified = true;

          await employer.save();
      
          return res.status(200).json({ message: "Employer details updated successfully" });
      }

     
      const newEmployer = new Employer({
          email,
          password,
          companyName,
          isVerified: true,
      });

      await newEmployer.save();
   

      res.status(201).json({ message: "Registration successful" });

  } catch (error) {
      console.error("❌ Error in employerRegistration:", error);
      res.status(500).json({ message: "Error processing request", error: error.message });
  }
};



  

    module.exports = {
        
        employerEmailVerify,
        employerRegistration,
        validCompanies,
    }