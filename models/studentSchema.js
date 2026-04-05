const mongoose = require("mongoose");
const { Schema, Types } = mongoose; 

const EducationSubSchema = new Schema(
  {
    degree: { type: String, default: "" },
    institution: { type: String, default: "" },
    startYear: { type: String, default: "" },
    endYear: { type: String, default: "" },
    gpa: { type: String, default: "" },
    description: { type: String, default: "" },
    achievements: [{ type: String }],
  },
  { _id: true }
);

const SkillSubSchema = new Schema(
  {
    name: { type: String, default: "" },
    level: { type: String, default: "beginner" },
    category: { type: String, default: "other" },
    endorsed: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Per-course learning progress (completed lessons, %) stored on the student record. */
const CourseModuleProgressSchema = new Schema(
  {
    moduleId: { type: Types.ObjectId },
    completedLessonIds: [{ type: Types.ObjectId }],
  },
  { _id: false }
);

const CourseLearningProgressSchema = new Schema(
  {
    courseId: { type: Types.ObjectId, ref: "Course", required: true },
    progressByModule: [CourseModuleProgressSchema],
    percentComplete: { type: Number, default: 0, min: 0, max: 100 },
    totalLessons: { type: Number, default: 0 },
    completedLessonsCount: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    lastAccessedAt: { type: Date },
    /** Last lesson the student had open (resume / crash-safe progress). */
    lastModuleId: { type: Types.ObjectId },
    lastLessonId: { type: Types.ObjectId },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** Per-user AI-generated course overview / lesson HTML (not shared across students). */
const CourseAiGeneratedEntrySchema = new Schema(
  {
    courseId: { type: Types.ObjectId, ref: "Course", required: true },
    mode: { type: String, enum: ["overview", "lesson"], required: true },
    lessonKey: { type: String, default: "" },
    moduleTitle: { type: String, default: "" },
    lessonTitle: { type: String, default: "" },
    contentMarkdown: { type: String, default: "" },
    contentHtml: { type: String, default: "" },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const StudentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    qualification: { type: String, trim: true },
    interests: { type: [String], trim: true },
    contact: { type: String, trim: true }, // Optional contact number

    bio: { type: String, trim: true, default: "" },
    github: { type: String, trim: true, default: "" },
    linkedin: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    dateOfBirth: { type: String, trim: true, default: "" },
    gender: { type: String, trim: true, default: "" },
    nationality: { type: String, trim: true, default: "" },
    avatar: { type: String, trim: true, default: "" },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      pincode: { type: String, default: "" },
    },
    education: [EducationSubSchema],
    skills: [SkillSubSchema],

    enrolledCourses: [{ type: Types.ObjectId, ref: "Enrollment" }],
    enrolledTests: [{ type: Types.ObjectId, ref: "Enrollment" }],

    // Purchased library documents that the student can access anytime
    purchasedLibraryDocuments: [{ type: Types.ObjectId, ref: "LibraryDocument" }],

    courseAiGeneratedContent: [CourseAiGeneratedEntrySchema],
    courseLearningProgress: [CourseLearningProgressSchema],
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", StudentSchema);
module.exports = Student;
