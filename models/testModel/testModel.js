const mongoose = require("mongoose");

const TestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true }, // Company name
    description: { type: String, required: true, trim: true },
    duration: { type: Number, required: true }, // Duration in minutes
    numberOfQuestions: { type: Number, required: true }, // Number of questions
    price: { 
      actual: { type: Number, required: true },
      discounted: { type: Number, required: true }
    },
    image: {
      type: String,
      default: 'https://res.cloudinary.com/djkbpwqpm/image/upload/v1746691763/jee_kai0bt.png' // Replace with your default image URL
    },
    imagePublicId: {
      type: String,
      default: null // Cloudinary public ID for image management
    },
    category: {
      type: String,
      trim: true
    },
    level: { 
      type: String, 
      enum: ["Beginner", "Intermediate", "Advanced", "Intermediate to Advanced"],
      required: true 
    },
    features: [{
      type: String,
      
    }],
    skills: [{
      type: String,
      trim: true
    }],
    certificate: { type: Boolean, default: true },
    quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }],
    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
    ratings: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
        rating: { type: Number, min: 1, max: 5 },
        review: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    passingScore: { type: Number, required: true },
    totalMarks: { type: Number, required: true }
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", TestSchema);
module.exports = Test;
