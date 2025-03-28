const mongoose = require("mongoose");

const TestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true }, // Test price
    category: { type: String, trim: true }, // Test category
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Instructor

    sections: [
      {
        title: { type: String, required: true, trim: true },
        questions: [
          {
            question: { type: String, required: true, trim: true },
            options: [{ type: String, required: true }],
            correctAnswer: { type: String, required: true },
            explanation: { type: String, trim: true } // Explanation for correct answer
          }
        ]
      }
    ],

    enrolledStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // Students who enrolled

    passingScore: { type: Number, required: true }, // Minimum passing score
    totalMarks: { type: Number, required: true }, // Total marks
  },
  { timestamps: true }
);

const Test = mongoose.model("Test", TestSchema);
module.exports = Test;
