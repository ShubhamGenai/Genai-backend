import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["error", "success", "info"], required: true }, //type of notification
    message: { type: String, required: true }, // Notification content
    status: { type: String, enum: ["unread", "read"], default: "unread" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
