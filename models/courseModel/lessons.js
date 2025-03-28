const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  videoUrl: { type: String, required: true, trim: true },
  duration: { type: Number }, // Duration in minutes
  practiceQuestions: [
    {
      question: { type: String, required: true, trim: true },
      description: { type: String, trim: true }
    }
  ],
  quiz: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }] // References Quiz Model
});

const Lesson = mongoose.model("Lesson", LessonSchema);
module.exports = Lesson;
