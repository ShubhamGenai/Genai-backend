const mongoose = require("mongoose");

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  duration: { type: Number, required: true }, // Duration in minutes
  questions: [
    {
      questionText: { type: String, required: true, trim: true },
      options: [{ type: String, required: true }],
      answer: { type: String, required: true },
      imageUrl: { type: String }, // Optional image/diagram URL for questions
      marks: { type: Number, default: 1 } // Marks for this question
    }
  ]
});

const Quiz = mongoose.model("Quiz", QuizSchema);
module.exports = Quiz;
