const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    category: { type: String, trim: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String, required: true },
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    startDate: { type: Date, default: Date.now },
    modules: [{ type: mongoose.Schema.Types.ObjectId, ref: "Module" }], // References Module Model
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    ratings: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
        rating: { type: Number, min: 1, max: 5 },
        review: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    averageRating: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", CourseSchema);
module.exports = Course;
