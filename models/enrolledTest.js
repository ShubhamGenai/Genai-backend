const mongoose = require("mongoose");

const EnrolledTestSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    paymentStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },

    testAttempts: [
      {
        attemptDate: { type: Date, default: Date.now },
        score: { type: Number, default: 0 },
        correctAnswers: { type: Number, default: 0 },
        incorrectAnswers: { type: Number, default: 0 },
        status: { type: String, enum: ["passed", "failed"], default: "failed" }
      }
    ],

    isPassed: { type: Boolean, default: false },
    certificateUrl: { type: String, trim: true }, // Stores certificate link after passing
  },
  { timestamps: true }
);

const EnrolledTest = mongoose.model("EnrolledTest", EnrolledTestSchema);
module.exports = EnrolledTest;
