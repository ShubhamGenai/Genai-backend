const mongoose = require("mongoose");

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  questions: [
    {
      questionText: { type: String, required: true, trim: true },
      options: [{ type: String, required: true }],
      answer: { type: String, required: true }
    }
  ]
});

const Quiz = mongoose.model("Quiz", QuizSchema);
module.exports = Quiz;
