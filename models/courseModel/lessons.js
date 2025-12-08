const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String,default:"none", trim: true },
  duration: { type: Number }, // Duration in minutes
 practiceQuestions: [
    {
      question: { type: String, required: true, trim: true }, // The prompt
      description: { type: String, trim: true }, // Additional info
      instructions: { type: String, trim: true }, // Additional info
      code: { type: String, trim: true }, // Starter or example code
      expectedAnswer: { type: String, trim: true } // Optional
    }
  ],
  quiz: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }] // References Quiz Model
});

const Lesson = mongoose.model("Lesson", LessonSchema);
module.exports = Lesson;
