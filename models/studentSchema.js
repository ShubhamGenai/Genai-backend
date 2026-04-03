const mongoose = require("mongoose");
const { Schema, Types } = mongoose; 

const EducationSubSchema = new Schema(
  {
    degree: { type: String, default: "" },
    institution: { type: String, default: "" },
    startYear: { type: String, default: "" },
    endYear: { type: String, default: "" },
    gpa: { type: String, default: "" },
    description: { type: String, default: "" },
    achievements: [{ type: String }],
  },
  { _id: true }
);

const SkillSubSchema = new Schema(
  {
    name: { type: String, default: "" },
    level: { type: String, default: "beginner" },
    category: { type: String, default: "other" },
    endorsed: { type: Number, default: 0 },
  },
  { _id: false }
);

const StudentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    qualification: { type: String, trim: true },
    interests: { type: [String], trim: true },
    contact: { type: String, trim: true }, // Optional contact number

    bio: { type: String, trim: true, default: "" },
    github: { type: String, trim: true, default: "" },
    linkedin: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    dateOfBirth: { type: String, trim: true, default: "" },
    gender: { type: String, trim: true, default: "" },
    nationality: { type: String, trim: true, default: "" },
    avatar: { type: String, trim: true, default: "" },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    education: [EducationSubSchema],
    skills: [SkillSubSchema],

    enrolledCourses: [{ type: Types.ObjectId, ref: "Enrollment" }],
    enrolledTests: [{ type: Types.ObjectId, ref: "Enrollment" }],

    // Purchased library documents that the student can access anytime
    purchasedLibraryDocuments: [{ type: Types.ObjectId, ref: "LibraryDocument" }],
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", StudentSchema);
module.exports = Student;
