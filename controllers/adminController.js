const Notification = require("../models/adminNotificationModel");
const Employer = require("../models/EmployerModel");
const User = require("../models/UserModel");
const bcrypt = require("bcryptjs");
const Student = require("../models/studentSchema");
const Admin = require("../models/adminModel");
const ContentManager = require("../models/ContentManagerModel");
const Course = require("../models/courseModel/courseModel");
const Test = require("../models/testModel/testModel");
const LibraryDocument = require("../models/libraryModel");
const EnrolledCourse = require("../models/courseModel/enrolledCourseModel");
const EnrolledTest = require("../models/testModel/enrolledTest");
const Submission = require("../models/testModel/SubmissionModel");
const StudentReport = require("../models/studentReportModel");
const StudentSchedule = require("../models/studentScheduleModel");
const Payment = require("../models/paymentSchema");

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
    const range = req.query?.range || "7d"; // 7d | 30d | 90d
    const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[range] || 7;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - (days - 1));

    const [
      totalUsers,
      totalStudents,
      totalEmployers,
      totalAdmins,
      totalContentManagers,
      totalCourses,
      totalTests,
      totalLibraryDocs,
      roleDistributionAgg,
      newUsersLast7Days,
      newStudentsLast7Days,
      submissionsLast7Days,
      topCoursesAgg,
      topTestsAgg,
      upcomingSchedules,
      revenueSummaryAgg,
      revenueByTypeAgg,
      revenueLast7DaysAgg,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "employer" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "content" }),
      Course.countDocuments({}),
      Test.countDocuments({}),
      LibraryDocument.countDocuments({}),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        { $match: { role: "student", createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]),
      Submission.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
            avgScore: { $avg: "$percentageScore" },
          },
        },
      ]),
      EnrolledCourse.aggregate([
        { $group: { _id: "$courseId", enrollments: { $sum: 1 } } },
        { $sort: { enrollments: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "_id",
            as: "course",
          },
        },
        { $unwind: { path: "$course", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            courseId: "$_id",
            title: "$course.title",
            category: "$course.category",
            level: "$course.level",
            enrollments: 1,
          },
        },
      ]),
      EnrolledTest.aggregate([
        { $group: { _id: "$testId", enrollments: { $sum: 1 }, passed: { $sum: { $cond: ["$isPassed", 1, 0] } } } },
        { $sort: { enrollments: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "tests",
            localField: "_id",
            foreignField: "_id",
            as: "test",
          },
        },
        { $unwind: { path: "$test", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            testId: "$_id",
            title: "$test.title",
            category: "$test.category",
            enrollments: 1,
            passed: 1,
          },
        },
      ]),
      StudentSchedule.find({ scheduledAt: { $gte: now }, status: "pending" })
        .sort({ scheduledAt: 1 })
        .limit(8)
        .populate("studentUserId", "name email")
        .lean(),
      Payment.aggregate([
        { $match: { status: "paid" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { status: "paid" } },
        {
          $project: {
            type: {
              $cond: [
                { $ifNull: ["$course", false] },
                "course",
                {
                  $cond: [{ $ifNull: ["$test", false] }, "test", "library"],
                },
              ],
            },
            amount: 1,
          },
        },
        {
          $group: {
            _id: "$type",
            revenue: { $sum: "$amount" },
            transactions: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { status: "paid", createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              y: { $year: "$createdAt" },
              m: { $month: "$createdAt" },
              d: { $dayOfMonth: "$createdAt" },
            },
            revenue: { $sum: "$amount" },
            transactions: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byRole = roleDistributionAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const dateLabels = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + idx);
      return {
        key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
        label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      };
    });

    const toDailyMap = (rows, valueKey = "count") =>
      rows.reduce((acc, row) => {
        const key = `${row._id.y}-${row._id.m}-${row._id.d}`;
        acc[key] = row[valueKey] ?? 0;
        return acc;
      }, {});

    const usersDailyMap = toDailyMap(newUsersLast7Days, "count");
    const studentsDailyMap = toDailyMap(newStudentsLast7Days, "count");
    const submissionsDailyMap = toDailyMap(submissionsLast7Days, "count");
    const submissionsAvgMap = toDailyMap(submissionsLast7Days, "avgScore");
    const revenueDailyMap = revenueLast7DaysAgg.reduce((acc, row) => {
      const key = `${row._id.y}-${row._id.m}-${row._id.d}`;
      acc[key] = { revenue: row.revenue || 0, transactions: row.transactions || 0 };
      return acc;
    }, {});

    const userGrowthLast7Days = dateLabels.map((d) => ({
      date: d.label,
      users: usersDailyMap[d.key] || 0,
      students: studentsDailyMap[d.key] || 0,
    }));

    const submissionsTrendLast7Days = dateLabels.map((d) => ({
      date: d.label,
      submissions: submissionsDailyMap[d.key] || 0,
      avgScore: Number((submissionsAvgMap[d.key] || 0).toFixed(2)),
    }));

    const revenueTrendLast7Days = dateLabels.map((d) => ({
      date: d.label,
      revenue: Number((revenueDailyMap[d.key]?.revenue || 0).toFixed(2)),
      transactions: revenueDailyMap[d.key]?.transactions || 0,
    }));

    const revenueByType = revenueByTypeAgg.map((r) => ({
      type: r._id,
      revenue: Number((r.revenue || 0).toFixed(2)),
      transactions: r.transactions || 0,
    }));

    const revenueSummary = revenueSummaryAgg?.[0] || { totalRevenue: 0, totalTransactions: 0 };

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
        analytics: {
          roleDistribution: [
            { role: "student", count: byRole.student || 0 },
            { role: "employer", count: byRole.employer || 0 },
            { role: "admin", count: byRole.admin || 0 },
            { role: "content", count: byRole.content || 0 },
          ],
          userGrowthLast7Days,
          submissionsTrendLast7Days,
          range,
          topCourses: topCoursesAgg || [],
          topTests: topTestsAgg || [],
          revenue: {
            totalRevenue: Number((revenueSummary.totalRevenue || 0).toFixed(2)),
            totalTransactions: revenueSummary.totalTransactions || 0,
            revenueByType,
            revenueTrendLast7Days,
          },
          upcomingSchedules: (upcomingSchedules || []).map((s) => ({
            id: s._id,
            title: s.title,
            type: s.type,
            scheduledAt: s.scheduledAt,
            studentName: s.studentUserId?.name || "Student",
            studentEmail: s.studentUserId?.email || null,
          })),
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
          mobile: 1,
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
        mobile: u.mobile || null,
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

// Fetch single user details by id (admin)
const getUserByIdForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("-password -otp -otpExpires -__v")
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let extra = null;
    if (user.role === "student") extra = await Student.findOne({ userId: user._id }).lean();
    if (user.role === "employer") extra = await Employer.findOne({ userId: user._id }).lean();
    if (user.role === "admin") extra = await Admin.findOne({ userId: user._id }).lean();
    if (user.role === "content") extra = await ContentManager.findOne({ userId: user._id }).lean();

    return res.json({ success: true, data: { ...user, details: extra || null } });
  } catch (error) {
    console.error("Error fetching user by id:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch user details" });
  }
};

// Update basic user fields by id (admin)
const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, isVerified, role } = req.body || {};

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof email === "string" && email.trim().toLowerCase() !== (user.email || "")) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).lean();
      if (existing) return res.status(400).json({ success: false, message: "Email already exists" });
      user.email = normalizedEmail;
    }
    if (typeof mobile === "string" && mobile.trim() !== (user.mobile || "")) {
      const normalizedMobile = mobile.trim();
      const existingMobile = await User.findOne({ mobile: normalizedMobile, _id: { $ne: user._id } }).lean();
      if (existingMobile) return res.status(400).json({ success: false, message: "Mobile already exists" });
      user.mobile = normalizedMobile;
    }
    if (typeof isVerified === "boolean") user.isVerified = isVerified;
    if (typeof role === "string" && ["student", "employer", "admin", "content"].includes(role)) {
      user.role = role;
    }

    await user.save();

    return res.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Error updating user by admin:", error);
    return res.status(500).json({ success: false, message: "Failed to update user" });
  }
};

// Delete user by id (admin)
const deleteUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "student") {
      const profile = await Student.findOne({ userId: user._id }).lean();
      await Promise.all([
        Student.deleteOne({ userId: user._id }),
        Submission.deleteMany({ user: user._id }),
        StudentReport.deleteMany({ studentUserId: user._id }),
        StudentSchedule.deleteMany({ studentUserId: user._id }),
        profile?._id ? EnrolledCourse.deleteMany({ studentId: profile._id }) : Promise.resolve(),
        profile?._id ? EnrolledTest.deleteMany({ studentId: profile._id }) : Promise.resolve(),
      ]);
    } else if (user.role === "employer") {
      await Employer.deleteOne({ userId: user._id });
    } else if (user.role === "admin") {
      await Admin.deleteOne({ userId: user._id });
    } else if (user.role === "content") {
      await ContentManager.deleteOne({ userId: user._id });
    }

    await User.deleteOne({ _id: user._id });
    return res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user by admin:", error);
    return res.status(500).json({ success: false, message: "Failed to delete user" });
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

// Detailed student profile + learning stats for admin
const getStudentDetailsForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Student user id is required" });
    }

    const user = await User.findOne({ _id: id, role: "student" })
      .select("-password -otp -otpExpires -__v")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const studentProfile = await Student.findOne({ userId: user._id }).lean();

    if (!studentProfile) {
      return res.json({
        success: true,
        data: {
          user,
          profile: null,
          stats: {
            enrolledCourses: 0,
            completedCourses: 0,
            enrolledTests: 0,
            passedTests: 0,
            totalTestAttempts: 0,
            averageTestScore: 0,
          },
          enrolledCourses: [],
          enrolledTests: [],
          recentSubmissions: [],
        },
      });
    }

    const [enrolledCourses, enrolledTests, submissions, transactions] = await Promise.all([
      EnrolledCourse.find({ studentId: studentProfile._id })
        .populate("courseId", "title category level")
        .sort({ createdAt: -1 })
        .lean(),
      EnrolledTest.find({ studentId: studentProfile._id })
        .populate("testId", "title category testType")
        .sort({ createdAt: -1 })
        .lean(),
      Submission.find({ user: user._id })
        .populate("testId", "title category")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Payment.find({
        $or: [{ userId: user._id }, { student: studentProfile._id }],
      })
        .populate("course", "title")
        .populate("test", "title")
        .populate("libraryDocument", "title name")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const testAttemptsCount = enrolledTests.reduce(
      (sum, item) => sum + (Array.isArray(item.testAttempts) ? item.testAttempts.length : 0),
      0
    );

    const scoreEntries = submissions
      .map((s) => Number(s.percentageScore))
      .filter((n) => Number.isFinite(n));
    const averageTestScore = scoreEntries.length
      ? Number((scoreEntries.reduce((a, b) => a + b, 0) / scoreEntries.length).toFixed(2))
      : 0;
    const paidTransactions = transactions.filter((t) => t.status === "paid");
    const totalPaidAmount = paidTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          role: user.role,
          isVerified: user.isVerified,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
          onboardingCompleted: user.onboardingCompleted,
          learningGoal: user.learningGoal,
          examPreference: user.examPreference,
          preferredSections: user.preferredSections || [],
          studyPreference: user.studyPreference,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        profile: {
          id: studentProfile._id,
          qualification: studentProfile.qualification,
          interests: studentProfile.interests || [],
          contact: studentProfile.contact,
          purchasedLibraryDocumentsCount: Array.isArray(studentProfile.purchasedLibraryDocuments)
            ? studentProfile.purchasedLibraryDocuments.length
            : 0,
          createdAt: studentProfile.createdAt,
        },
        stats: {
          enrolledCourses: enrolledCourses.length,
          completedCourses: enrolledCourses.filter((c) => c.isCompleted).length,
          enrolledTests: enrolledTests.length,
          passedTests: enrolledTests.filter((t) => t.isPassed).length,
          totalTestAttempts: testAttemptsCount,
          averageTestScore,
          totalTransactions: transactions.length,
          paidTransactions: paidTransactions.length,
          totalPaidAmount: Number(totalPaidAmount.toFixed(2)),
        },
        enrolledCourses: enrolledCourses.map((c) => ({
          id: c._id,
          courseId: c.courseId?._id || null,
          title: c.courseId?.title || "Course",
          category: c.courseId?.category || null,
          level: c.courseId?.level || null,
          paymentStatus: c.paymentStatus,
          isCompleted: c.isCompleted,
          enrolledAt: c.enrolledAt || c.createdAt,
        })),
        enrolledTests: enrolledTests.map((t) => ({
          id: t._id,
          testId: t.testId?._id || null,
          title: t.testId?.title || "Test",
          category: t.testId?.category || null,
          testType: t.testId?.testType || null,
          paymentStatus: t.paymentStatus,
          isPassed: t.isPassed,
          attemptsCount: Array.isArray(t.testAttempts) ? t.testAttempts.length : 0,
          latestAttempt:
            Array.isArray(t.testAttempts) && t.testAttempts.length > 0
              ? t.testAttempts[t.testAttempts.length - 1]
              : null,
          enrolledAt: t.createdAt,
        })),
        recentSubmissions: submissions.map((s) => ({
          id: s._id,
          testId: s.testId?._id || null,
          testTitle: s.testId?.title || "Test",
          category: s.testId?.category || null,
          percentageScore: s.percentageScore ?? null,
          obtainedMarks: s.obtainedMarks ?? null,
          totalMarks: s.totalMarks ?? null,
          status: s.status || null,
          submittedAt: s.createdAt,
        })),
        transactions: transactions.map((t) => ({
          id: t._id,
          amount: t.amount ?? 0,
          status: t.status || "created",
          razorpayOrderId: t.razorpayOrderId || null,
          razorpayPaymentId: t.razorpayPaymentId || null,
          type: t.course ? "course" : t.test ? "test" : t.libraryDocument ? "library" : "other",
          itemName:
            t.course?.title ||
            t.test?.title ||
            t.libraryDocument?.title ||
            t.libraryDocument?.name ||
            "—",
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching student details for admin:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student details",
    });
  }
};

// Create student by admin with temporary password
const createStudentByAdmin = async (req, res) => {
  try {
    const { name, email, mobile, qualification, interests, contact } = req.body || {};

    if (!name || (!email && !mobile)) {
      return res.status(400).json({
        success: false,
        message: "Name and at least one of email or mobile is required",
      });
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedMobile = typeof mobile === "string" ? mobile.trim() : "";

    if (normalizedEmail) {
      const existingByEmail = await User.findOne({ email: normalizedEmail }).lean();
      if (existingByEmail) {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
    }

    if (normalizedMobile) {
      const existingByMobile = await User.findOne({ mobile: normalizedMobile }).lean();
      if (existingByMobile) {
        return res.status(400).json({ success: false, message: "Mobile number already exists" });
      }
    }

    const tempPassword = `Temp@${Math.random().toString(36).slice(-6)}${Date.now()
      .toString()
      .slice(-2)}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail || undefined,
      mobile: normalizedMobile || undefined,
      password: hashedPassword,
      role: "student",
      isVerified: true,
      isEmailVerified: !!normalizedEmail,
      isMobileVerified: !!normalizedMobile,
    });

    const studentInterests = Array.isArray(interests)
      ? interests.filter(Boolean)
      : typeof interests === "string"
      ? interests
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean)
      : [];

    await Student.create({
      userId: user._id,
      qualification: qualification || "",
      interests: studentInterests,
      contact: contact || normalizedMobile || "",
    });

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        temporaryPassword: tempPassword,
        note: "Student can change this password using forgot password / set password flow",
      },
    });
  } catch (error) {
    console.error("Error creating student by admin:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create student",
    });
  }
};

const updateStudentByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, mobile, qualification, interests, contact, isVerified } = req.body || {};

    const user = await User.findOne({ _id: id, role: "student" });
    if (!user) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedMobile = typeof mobile === "string" ? mobile.trim() : "";

    if (normalizedEmail && normalizedEmail !== (user.email || "")) {
      const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).lean();
      if (existingEmail) {
        return res.status(400).json({ success: false, message: "Email already exists" });
      }
      user.email = normalizedEmail;
    }
    if (normalizedMobile && normalizedMobile !== (user.mobile || "")) {
      const existingMobile = await User.findOne({ mobile: normalizedMobile, _id: { $ne: user._id } }).lean();
      if (existingMobile) {
        return res.status(400).json({ success: false, message: "Mobile number already exists" });
      }
      user.mobile = normalizedMobile;
    }
    if (typeof name === "string" && name.trim()) user.name = name.trim();
    if (typeof isVerified === "boolean") user.isVerified = isVerified;
    await user.save();

    const profile = await Student.findOne({ userId: user._id });
    if (profile) {
      if (typeof qualification === "string") profile.qualification = qualification;
      if (typeof contact === "string") profile.contact = contact;
      if (Array.isArray(interests)) {
        profile.interests = interests.filter(Boolean);
      } else if (typeof interests === "string") {
        profile.interests = interests.split(",").map((i) => i.trim()).filter(Boolean);
      }
      await profile.save();
    }

    return res.json({
      success: true,
      message: "Student updated successfully",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        isVerified: user.isVerified,
        qualification: profile?.qualification || null,
        interests: profile?.interests || [],
      },
    });
  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({ success: false, message: "Failed to update student" });
  }
};

const deleteStudentByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: "student" });
    if (!user) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const profile = await Student.findOne({ userId: user._id }).lean();

    await Promise.all([
      User.deleteOne({ _id: user._id }),
      Student.deleteOne({ userId: user._id }),
      Submission.deleteMany({ user: user._id }),
      StudentReport.deleteMany({ studentUserId: user._id }),
      StudentSchedule.deleteMany({ studentUserId: user._id }),
      profile?._id ? EnrolledCourse.deleteMany({ studentId: profile._id }) : Promise.resolve(),
      profile?._id ? EnrolledTest.deleteMany({ studentId: profile._id }) : Promise.resolve(),
    ]);

    return res.json({ success: true, message: "Student deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    return res.status(500).json({ success: false, message: "Failed to delete student" });
  }
};

const getStudentSchedules = async (req, res) => {
  try {
    const { studentUserId, fromDate, toDate, status = "all" } = req.query;
    const match = {};
    if (studentUserId) match.studentUserId = studentUserId;
    if (status !== "all") match.status = status;
    if (fromDate || toDate) {
      match.scheduledAt = {};
      if (fromDate) match.scheduledAt.$gte = new Date(`${fromDate}T00:00:00`);
      if (toDate) match.scheduledAt.$lte = new Date(`${toDate}T23:59:59`);
    }

    const rows = await StudentSchedule.find(match)
      .sort({ scheduledAt: 1 })
      .populate("studentUserId", "name email mobile")
      .lean();

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r._id,
        studentUserId: r.studentUserId?._id || null,
        studentName: r.studentUserId?.name || "Student",
        studentEmail: r.studentUserId?.email || null,
        title: r.title,
        type: r.type,
        scheduledAt: r.scheduledAt,
        note: r.note,
        status: r.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch schedules" });
  }
};

const createStudentSchedule = async (req, res) => {
  try {
    const { studentUserId, title, type = "followup", scheduledAt, note = "" } = req.body || {};
    if (!studentUserId || !title || !scheduledAt) {
      return res.status(400).json({ success: false, message: "studentUserId, title and scheduledAt are required" });
    }

    const student = await User.findOne({ _id: studentUserId, role: "student" }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const created = await StudentSchedule.create({
      studentUserId,
      title: title.trim(),
      type,
      scheduledAt: new Date(scheduledAt),
      note,
      createdBy: req.user.id,
    });

    return res.status(201).json({ success: true, message: "Schedule created", data: created });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return res.status(500).json({ success: false, message: "Failed to create schedule" });
  }
};

const updateStudentSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, scheduledAt, note, status } = req.body || {};
    const update = {};
    if (typeof title === "string") update.title = title.trim();
    if (typeof type === "string") update.type = type;
    if (scheduledAt) update.scheduledAt = new Date(scheduledAt);
    if (typeof note === "string") update.note = note;
    if (typeof status === "string") update.status = status;

    const updated = await StudentSchedule.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }
    return res.json({ success: true, message: "Schedule updated", data: updated });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return res.status(500).json({ success: false, message: "Failed to update schedule" });
  }
};

const deleteStudentSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await StudentSchedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }
    return res.json({ success: true, message: "Schedule deleted" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return res.status(500).json({ success: false, message: "Failed to delete schedule" });
  }
};

// Save generated report metadata for admin history table
const saveStudentReport = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const {
      studentUserId,
      studentName,
      studentEmail,
      testFilter = "all",
      fromDate = null,
      toDate = null,
      summary = {},
      fileName = "",
    } = req.body || {};

    if (!adminId || !studentUserId) {
      return res.status(400).json({
        success: false,
        message: "adminId and studentUserId are required",
      });
    }

    const saved = await StudentReport.create({
      adminId,
      studentUserId,
      studentName,
      studentEmail,
      testFilter,
      fromDate: fromDate ? new Date(fromDate) : null,
      toDate: toDate ? new Date(toDate) : null,
      summary: {
        enrolledCourses: Number(summary.enrolledCourses || 0),
        completedCourses: Number(summary.completedCourses || 0),
        enrolledTests: Number(summary.enrolledTests || 0),
        passedTests: Number(summary.passedTests || 0),
        totalTestAttempts: Number(summary.totalTestAttempts || 0),
        averageTestScore: Number(summary.averageTestScore || 0),
      },
      fileName,
    });

    return res.status(201).json({
      success: true,
      message: "Report saved",
      data: saved,
    });
  } catch (error) {
    console.error("Error saving student report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save report",
    });
  }
};

// List saved reports for admin (latest first)
const getSavedStudentReports = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || "20", 10)));
    const studentUserId = req.query.studentUserId || null;

    const match = { adminId };
    if (studentUserId) match.studentUserId = studentUserId;

    const [reports, total] = await Promise.all([
      StudentReport.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StudentReport.countDocuments(match),
    ]);

    return res.json({
      success: true,
      data: reports.map((r) => ({
        id: r._id,
        studentUserId: r.studentUserId,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        testFilter: r.testFilter,
        fromDate: r.fromDate,
        toDate: r.toDate,
        summary: r.summary,
        fileName: r.fileName,
        createdAt: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching saved student reports:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch saved reports",
    });
  }
};

module.exports = {
  notification,
  approveDomain,
  notificationStatusUpdate,
  getAdminOverview,
  getUsersByRole,
  getUserByIdForAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  getStudentsForAdmin,
  updateStudentByAdmin,
  deleteStudentByAdmin,
  toggleStudentVerification,
  getStudentDetailsForAdmin,
  createStudentByAdmin,
  getStudentSchedules,
  createStudentSchedule,
  updateStudentSchedule,
  deleteStudentSchedule,
  saveStudentReport,
  getSavedStudentReports,
};