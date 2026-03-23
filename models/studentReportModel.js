const mongoose = require("mongoose");

const StudentReportSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentName: { type: String, trim: true },
    studentEmail: { type: String, trim: true, lowercase: true },
    testFilter: { type: String, default: "all" },
    fromDate: { type: Date, default: null },
    toDate: { type: Date, default: null },
    summary: {
      enrolledCourses: { type: Number, default: 0 },
      completedCourses: { type: Number, default: 0 },
      enrolledTests: { type: Number, default: 0 },
      passedTests: { type: Number, default: 0 },
      totalTestAttempts: { type: Number, default: 0 },
      averageTestScore: { type: Number, default: 0 },
    },
    fileName: { type: String, trim: true },
  },
  { timestamps: true }
);

const StudentReport = mongoose.model("StudentReport", StudentReportSchema);
module.exports = StudentReport;
