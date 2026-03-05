const mongoose = require("mongoose");
const { Schema, Types } = mongoose; 

const StudentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    qualification: { type: String, trim: true },
    interests: { type: [String], trim: true },
    contact: { type: String, trim: true }, // Optional contact number

    enrolledCourses: [{ type: Types.ObjectId, ref: "Enrollment" }],
    enrolledTests: [{ type: Types.ObjectId, ref: "Enrollment" }],

    // Purchased library documents that the student can access anytime
    purchasedLibraryDocuments: [{ type: Types.ObjectId, ref: "LibraryDocument" }],
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", StudentSchema);
module.exports = Student;
