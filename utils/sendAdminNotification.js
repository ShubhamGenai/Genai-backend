import Notification from "../models/adminNotificationModel.js";


const sendAdminNotification = async (type, message) => {
  try {
    // Save notification in MongoDB
    await Notification.create({ type, message });

  } catch (error) {
    console.error("Error saving admin notification:", error);
  }
};

export default sendAdminNotification