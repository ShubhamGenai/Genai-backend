const Student = require("../models/studentSchema");
const StudentActivity = require("../models/studentActivityModel");

const logStudentActivity = async ({
  userId,
  studentId,
  eventType,
  source = "student_api",
  courseId,
  moduleId,
  lessonId,
  testId,
  submissionId,
  status = "ok",
  progressPercent,
  score,
  metadata = {},
}) => {
  try {
    let resolvedStudentId = studentId;
    if (!resolvedStudentId && userId) {
      const student = await Student.findOne({ userId }).select("_id").lean();
      resolvedStudentId = student?._id;
    }
    if (!resolvedStudentId || !userId || !eventType) return;

    await StudentActivity.create({
      studentId: resolvedStudentId,
      userId,
      eventType,
      source,
      courseId: courseId || undefined,
      moduleId: moduleId || undefined,
      lessonId: lessonId || undefined,
      testId: testId || undefined,
      submissionId: submissionId || undefined,
      status,
      progressPercent: typeof progressPercent === "number" ? progressPercent : undefined,
      score: typeof score === "number" ? score : undefined,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("logStudentActivity:", error.message);
  }
};

const getMyActivityTimeline = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const student = await Student.findOne({ userId }).select("_id");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const eventType = typeof req.query.eventType === "string" ? req.query.eventType : null;
    const query = { studentId: student._id };
    if (eventType) query.eventType = eventType;

    const items = await StudentActivity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, items });
  } catch (error) {
    console.error("getMyActivityTimeline:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch activity timeline",
    });
  }
};

const trackMyActivity = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const student = await Student.findOne({ userId }).select("_id");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const { eventType = "manual", source, courseId, moduleId, lessonId, testId, status, progressPercent, score, metadata } = req.body || {};
    await logStudentActivity({
      userId,
      studentId: student._id,
      eventType,
      source: source || "manual",
      courseId,
      moduleId,
      lessonId,
      testId,
      status: status || "ok",
      progressPercent,
      score,
      metadata,
    });

    return res.json({ success: true, message: "Activity tracked" });
  } catch (error) {
    console.error("trackMyActivity:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to track activity" });
  }
};

module.exports = {
  logStudentActivity,
  getMyActivityTimeline,
  trackMyActivity,
};
