const mongoose = require("mongoose");


const courseImages = [
  "https://res.cloudinary.com/djkbpwqpm/image/upload/v1746691773/designwithai_gobbbw.jpg",
  "https://res.cloudinary.com/djkbpwqpm/image/upload/v1746691773/promptengineering_r2kosa.jpg",
  "https://res.cloudinary.com/djkbpwqpm/image/upload/v1746691768/dataanalytics_xmodtp.jpg",
];

const getRandomImageUrl = () => {
  return courseImages[Math.floor(Math.random() * courseImages.length)];
};

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    courseDescription: { type: String, required: true, trim: true },
  
    price: { 
      actual: { type: Number, required: true },
      discounted: { type: Number, required: true }
    },
    category: { type: String, trim: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String ,default: getRandomImageUrl},
    level: { type: String, enum: ["Beginner", "Intermediate", "Advanced"], default: "Beginner" },
    startDate: { type: Date, default: Date.now },
    modules: [{ type: mongoose.Schema.Types.ObjectId, ref: "Module" }], // References Module Model
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isBestSeller: { type: Boolean, default: false },
    features: [{
      type: String,
     
    }],
    learningOutcomes: [String], // ✅ NEW: "What you'll learn"
    targetAudience: [String],   // ✅ NEW: "Who should take this course"
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
