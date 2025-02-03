const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: [
    { type: String, required: true }, // Four answer choices
    { type: String, required: true },
    { type: String, required: true },
    { type: String, required: true }
  ],
  correctAnswerIndex: { type: Number, required: true, min: 0, max: 3 }, // Index (0-3)
});

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true }, // ⏳ Duration in minutes
  questions: [questionSchema], // Array of questions
});

const testModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  tests: [testSchema], // Multiple tests inside the module
});

const learnModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  videoUrl: { type: String, required: true },
  duration: { type: Number, required: true }, // ⏳ Duration in minutes
});

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true, trim: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    imageUrl: { type: String, required: true },
    level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
    startDate: { type: Date, default: Date.now },

    // Pricing
    learnPrice: { type: Number, required: true },
    testPrice: { type: Number, required: true },

    // Learning Modules
    learnModules: [learnModuleSchema],

    // Test Modules (with duration)
    testModules: [testModuleSchema],

    // Prerequisites
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],

    // Enrolled students
    enrolledForLearn: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        paymentStatus: { type: Boolean, default: false }, 
        enrolledAt: { type: Date, default: Date.now },
      },
    ],
    enrolledForTest: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        paymentStatus: { type: Boolean, default: false }, 
        enrolledAt: { type: Date, default: Date.now },
      },
    ],

    // Ratings & Reviews
    ratings: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rating: { type: Number, min: 1, max: 5, required: true },
        review: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Course', courseSchema);
