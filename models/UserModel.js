const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true,},
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String},
    mobile: { type: String, trim: true, sparse: true }, // Mobile number for OTP login
    googleId: { type: String, trim: true },
    role: { type: String, enum: ["student", "employer", "admin","content"], required: true },
    isProfileVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false }, // Mobile verification status
    otp: { type: String, trim: true },
    otpExpires: { type: Date },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
module.exports = User;
