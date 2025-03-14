const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true,},
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String},
    role: { type: String, enum: ["student", "employer", "admin"], required: true },
    isProfileVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    otp: { type: String, trim: true },
    otpExpires: { type: Date },
  },
  { timestamps: true }
);

// **Hash password before saving**
// UserSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

const User = mongoose.model("User", UserSchema);
module.exports = User;
