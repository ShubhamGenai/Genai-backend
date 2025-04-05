const mongoose = require("mongoose");

const TestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true }, // Test price
    category: { type: String, trim: true }, // Test category
    instructor: { type: String, ref: "User", required: true }, // Instructor
    duration: { type: String, default: 1 },
    level:{type:String, enum:["easy","medium","hard"], default:"easy"},
    quizzes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }] ,// References Quiz Model

    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // Students who enrolled

     ratings: [
          {
            studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
            rating: { type: Number, min: 1, max: 5 },
            review: { type: String, trim: true },
            createdAt: { type: Date, default: Date.now }
          }
        ],
        averageRating: { type: Number, default: 0 },

    passingScore: { type: Number, required: true }, // Minimum passing score
    totalMarks: { type: Number, required: true }, // Total marks
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", TestSchema);
module.exports = Test;
