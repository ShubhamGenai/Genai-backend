const mongoose = require("mongoose");

const StudentActivitySchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: [
        "course_progress",
        "course_enroll",
        "course_payment",
        "test_submit",
        "test_enroll",
        "test_payment",
        "quiz_submit",
        "profile_update",
        "manual",
      ],
      index: true,
    },
    source: { type: String, default: "student_api" },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    moduleId: { type: mongoose.Schema.Types.ObjectId },
    lessonId: { type: mongoose.Schema.Types.ObjectId },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test" },
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },
    status: { type: String, default: "ok" },
    progressPercent: { type: Number, min: 0, max: 100 },
    score: { type: Number },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

StudentActivitySchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model("StudentActivity", StudentActivitySchema);
