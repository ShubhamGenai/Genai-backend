const mongoose = require("mongoose");
const { Schema, Types } = mongoose; 

const EnrolledCourseSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    paymentStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    enrolledAt: { type: Date, default: Date.now },
    progress: [
      {
        moduleId: { type: mongoose.Schema.Types.ObjectId },
        completedLessons: [{ type: mongoose.Schema.Types.ObjectId }]
      }
    ],
    isCompleted: { type: Boolean, default: false }, // Marks course completion
    certificateUrl: { type: String, trim: true }, // Stores certificate link after completion
  },
  { timestamps: true }
);

const EnrolledCourse = mongoose.model("EnrolledCourse", EnrolledCourseSchema);
module.exports = EnrolledCourse;