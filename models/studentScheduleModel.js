const mongoose = require("mongoose");

const StudentScheduleSchema = new mongoose.Schema(
  {
    studentUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["class", "test", "meeting", "followup", "other"],
      default: "followup",
    },
    scheduledAt: { type: Date, required: true },
    note: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["pending", "completed", "cancelled"], default: "pending" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const StudentSchedule = mongoose.model("StudentSchedule", StudentScheduleSchema);
module.exports = StudentSchedule;
