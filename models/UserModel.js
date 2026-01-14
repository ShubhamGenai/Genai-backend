const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    mobile: { type: String, trim: true, sparse: true }, // Mobile number for OTP login
    googleId: { type: String, trim: true },
    role: { type: String, enum: ["student", "employer", "admin", "content"], required: true },
    isProfileVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false }, // Mobile verification status
    otp: { type: String, trim: true },
    otpExpires: { type: Date },

    // ================== LEARNING GOAL & PREFERENCES (Student Onboarding) ==================
    // High level goal for the student (e.g. NEET, JEE, Technical skills, Non-technical etc.)
    learningGoal: {
      type: String,
      enum: ["neet", "jee", "technical", "non-technical", "other"],
      default: null,
    },
    // More detailed exam / stream preference (e.g. "NEET 2026", "JEE Mains", "Full‑stack development")
    examPreference: {
      type: String,
      trim: true,
      default: null,
    },
    // Which sections of the platform the student is most interested in (Learn, Tests, Jobs, Library, AI‑Chat etc.)
    preferredSections: [
      {
        type: String,
        trim: true,
      },
    ],
    // Free‑form preference text or tags (e.g. "Physics focus", "DSA + System Design")
    studyPreference: {
      type: String,
      trim: true,
      default: null,
    },
    // Flag to know if the user has completed the goal/preferences popup at least once
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
module.exports = User;
