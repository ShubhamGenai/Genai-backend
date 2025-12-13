// models/Submission.js
const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: String,
  quizId: String,
  questionIndex: Number,
  questionText: String,
  selectedOption: String,
  correctAnswer: String,
  isCorrect: Boolean,
  options: [String],
  marks: Number,
  obtainedMarks: Number
});

const submissionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
  quizIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' }],
  answers: [answerSchema],
  startTime: Date,
  endTime: Date,
  duration: String,
  markedQuestions: [String],
  totalQuestions: Number,
  totalMarks: Number,
  obtainedMarks: Number,
  percentageScore: Number,
  status: String
}, { timestamps: true });

module.exports = mongoose.model('Submission', submissionSchema);
