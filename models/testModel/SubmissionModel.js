// models/Submission.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: String,
  quizId: String,
  questionIndex: Number,
  selectedOption: String,
  isCorrect: Boolean
});

const submissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quizIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  answers: [answerSchema],
  startTime: Date,
  endTime: Date,
  duration: String,
  markedQuestions: [String],
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
