const Notification = require("../models/adminNotificationModel"); // Corrected import

async function sendAdminNotification(type, message) {
  try {
    if (!type || !message) {
      throw new Error("Notification type and message are required");
    }

    // Save notification in MongoDB
    const newNotification = new Notification({ type, message });
    await newNotification.save();
  } catch (error) {
    console.error("Error saving admin notification:", error.message);
  }
}

module.exports = sendAdminNotification; // ✅ Corrected export
