import Notification from "../models/adminNotificationModel";
import { Employer, Whitelist } from "../models/EmployerModel";

// approve dcomain
const approveDomain = async (req, res) => {
    const { domain } = req.body;
  
    try {
      const company = await Whitelist.findOneAndUpdate(
        { domain },
        { approved: true },
        { new: true }
      );
  
      if (!company) return res.status(404).json({ message: "Domain not found" });
  
      // ✅ Update existing employers with this domain
      await Employer.updateMany({ email: new RegExp(`@${domain}$`) }, { isVerified: true });
  
      res.json({ message: `Domain ${domain} approved` });
    } catch (error) {
      res.status(500).json({ message: "Error approving domain" });
    }
  }



// frtching latest notification
  const notification = async (req, res) => {
    try {
      const notifications = await Notification.find().sort({ createdAt: -1 });
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Error fetching notifications" });
    }
  }


  // notification status Update

  const notificationStatusUpdate = async (req, res) => {
    try {
      await Notification.findByIdAndUpdate(req.params.id, { status: "read" });
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Error updating notification" });
    }
  }

  module.exports = {notification,
     approveDomain,
     notificationStatusUpdate}