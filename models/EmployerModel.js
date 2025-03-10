import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Whitelist Schema
const WhitelistSchema = new mongoose.Schema({
  domain: { type: String, unique: true, required: true },
  approved: { type: Boolean, default: false },
});

const Whitelist = mongoose.model("Whitelist", WhitelistSchema);

// Employer Schema
const employerSchema = new mongoose.Schema(
  {
    companyName: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, },
    isVerified: { type: Boolean, default: false },
    isAdminVerified: { type: Boolean, default: false },
    isDomainVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["employer", "admin"], default: "employer" },
  },
  { timestamps: true }
);

// Hash password before saving
employerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const Employer = mongoose.model("Employer", employerSchema);

// ✅ Export both models
export { Whitelist, Employer };
