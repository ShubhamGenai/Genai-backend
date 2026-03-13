const Notification = require("../models/adminNotificationModel");
const Employer = require("../models/EmployerModel");
const User = require("../models/UserModel");
const Student = require("../models/studentSchema");
const Admin = require("../models/adminModel");
const ContentManager = require("../models/ContentManagerModel");
const Course = require("../models/courseModel/courseModel");
const Test = require("../models/testModel/testModel");
const LibraryDocument = require("../models/libraryModel");

// Approve employer email domain and auto‑verify matching employers
const approveDomain = async (req, res) => {
  const { domain } = req.body;

  try {
    if (!domain) {
      return res.status(400).json({ message: "Domain is required" });
    }

    // NOTE: Whitelist model was referenced previously but not exported here.
    // If you add a dedicated whitelist model later, plug it in here.

    // Mark employers with this domain (or matching domain string) as verified
    const domainNorm = domain.replace(/^\.+|\s+/g, "").toLowerCase();
    const result = await Employer.updateMany(
      { $or: [{ domain: new RegExp(domainNorm, "i") }, { domain: domain }] },
      { isDomainVerified: true }
    );

    return res.json({
      success: true,
      message: `Domain ${domain} approved for ${result.modifiedCount} employers`,
    });
  } catch (error) {
    console.error("Error approving domain:", error);
    res.status(500).json({ message: "Error approving domain" });
  }
};

// Fetch latest admin notifications
const notification = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Error fetching notifications" });
  }
};

// Mark notification as read
const notificationStatusUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Notification id is required" });
    }

    await Notification.findByIdAndUpdate(id, { status: "read" });
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ success: false, message: "Error updating notification" });
  }
};

// Simple admin‑only dashboard overview (counts)
const getAdminOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalEmployers,
      totalAdmins,
      totalContentManagers,
      totalCourses,
      totalTests,
      totalLibraryDocs,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "employer" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "content" }),
      Course.countDocuments({}),
      Test.countDocuments({}),
      LibraryDocument.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          students: totalStudents,
          employers: totalEmployers,
          admins: totalAdmins,
          contentManagers: totalContentManagers,
        },
        content: {
          courses: totalCourses,
          tests: totalTests,
          libraryDocuments: totalLibraryDocs,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching admin overview:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin overview",
    });
  }
};

// Paginated student list for admin panel
const getStudentsForAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all", // active | inactive | all
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

    const userMatch = { role: "student" };

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      userMatch.$or = [{ name: regex }, { email: regex }];
    }

    if (status === "active") {
      userMatch.isVerified = true;
    } else if (status === "inactive") {
      userMatch.isVerified = false;
    }

    const pipeline = [
      { $match: userMatch },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "userId",
          as: "studentProfile",
        },
      },
      { $unwind: { path: "$studentProfile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          role: 1,
          isVerified: 1,
          isEmailVerified: 1,
          isMobileVerified: 1,
          createdAt: 1,
          "studentProfile._id": 1,
          "studentProfile.qualification": 1,
          "studentProfile.enrolledCourses": 1,
          "studentProfile.enrolledTests": 1,
          "studentProfile.createdAt": 1,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [{ $skip: (pageNum - 1) * pageSize }, { $limit: pageSize }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await User.aggregate(pipeline);
    const students = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    return res.json({
      success: true,
      data: students.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        isVerified: u.isVerified,
        isEmailVerified: u.isEmailVerified,
        isMobileVerified: u.isMobileVerified,
        createdAt: u.createdAt,
        studentProfileId: u.studentProfile?._id || null,
        qualification: u.studentProfile?.qualification || null,
        enrolledCoursesCount: Array.isArray(u.studentProfile?.enrolledCourses)
          ? u.studentProfile.enrolledCourses.length
          : 0,
        enrolledTestsCount: Array.isArray(u.studentProfile?.enrolledTests)
          ? u.studentProfile.enrolledTests.length
          : 0,
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching admin students:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
};

// Fetch users by role (admin panel) – optional role filter, pagination, search
const getUsersByRole = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "all", // student | employer | admin | content | all
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

    const match = {};

    if (role && role !== "all") {
      const validRoles = ["student", "employer", "admin", "content"];
      if (validRoles.includes(role)) {
        match.role = role;
      }
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      match.$or = [{ name: regex }, { email: regex }];
    }

    const [data, total] = await Promise.all([
      User.find(match)
        .select("-password -otp -otpExpires -__v")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      User.countDocuments(match),
    ]);

    return res.json({
      success: true,
      data: data.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        isVerified: u.isVerified,
        isEmailVerified: u.isEmailVerified,
        isMobileVerified: u.isMobileVerified,
        isProfileVerified: u.isProfileVerified,
        onboardingCompleted: u.onboardingCompleted,
        learningGoal: u.learningGoal,
        examPreference: u.examPreference,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error fetching users by role:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// Toggle student verification (basic user management)
const toggleStudentVerification = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "User id is required" });
    }

    const user = await User.findById(id);
    if (!user || user.role !== "student") {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    user.isVerified = !user.isVerified;
    await user.save();

    return res.json({
      success: true,
      message: `Student verification set to ${user.isVerified}`,
      user: {
        id: user._id,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Error toggling student verification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update student verification",
    });
  }
};

module.exports = {
  notification,
  approveDomain,
  notificationStatusUpdate,
  getAdminOverview,
  getUsersByRole,
  getStudentsForAdmin,
  toggleStudentVerification,
};