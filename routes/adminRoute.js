const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/AuthMiddleware");
const adminController = require("../controllers/adminController");

// Ensure the requester is an authenticated admin user
const requireAdmin = [authMiddleware, (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}];

// Admin dashboard overview
router.get("/overview", requireAdmin, adminController.getAdminOverview);

// Users by role (query: role, page, limit, search)
router.get("/users", requireAdmin, adminController.getUsersByRole);
router.get("/users/:id", requireAdmin, adminController.getUserByIdForAdmin);
router.put("/users/:id", requireAdmin, adminController.updateUserByAdmin);
router.delete("/users/:id", requireAdmin, adminController.deleteUserByAdmin);

// Students management
router.get("/students", requireAdmin, adminController.getStudentsForAdmin);
router.post("/students", requireAdmin, adminController.createStudentByAdmin);
router.put("/students/:id", requireAdmin, adminController.updateStudentByAdmin);
router.delete("/students/:id", requireAdmin, adminController.deleteStudentByAdmin);
router.get("/student-reports", requireAdmin, adminController.getSavedStudentReports);
router.post("/student-reports", requireAdmin, adminController.saveStudentReport);
router.get("/student-schedules", requireAdmin, adminController.getStudentSchedules);
router.post("/student-schedules", requireAdmin, adminController.createStudentSchedule);
router.patch("/student-schedules/:id", requireAdmin, adminController.updateStudentSchedule);
router.delete("/student-schedules/:id", requireAdmin, adminController.deleteStudentSchedule);
router.get("/students/:id/details", requireAdmin, adminController.getStudentDetailsForAdmin);
router.patch(
  "/students/:id/toggle-verification",
  requireAdmin,
  adminController.toggleStudentVerification
);

// Notifications
router.get("/notifications", requireAdmin, adminController.notification);
router.patch(
  "/notifications/:id/read",
  requireAdmin,
  adminController.notificationStatusUpdate
);

// Domain approval (employer onboarding)
router.post("/approve-domain", requireAdmin, adminController.approveDomain);

module.exports = router;