const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["error", "success", "info"], required: true }, // Type of notification
    message: { type: String, required: true }, // Notification content
    status: { type: String, enum: ["unread", "read"], default: "unread" },
  },
  { timestamps: true } // Automatically adds createdAt & updatedAt
);

module.exports = mongoose.model("Notification", notificationSchema);
