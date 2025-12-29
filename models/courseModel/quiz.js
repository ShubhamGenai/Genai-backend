const mongoose = require("mongoose");

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  duration: { type: Number, required: true }, // Duration in minutes
  questions: [
    {
      questionText: { type: String, required: true, trim: true },
      options: [{ type: String, required: true }],
      answer: { type: String, required: true },
      imageUrl: { 
        type: String, 
        default: null,
        validate: {
          validator: function(v) {
            // Allow null/empty or valid URL (Cloudinary URLs)
            return !v || /^https?:\/\/.+/.test(v);
          },
          message: 'imageUrl must be a valid URL (Cloudinary URL)'
        }
      }, // Cloudinary URL for question images/diagrams
      imagePublicId: { type: String, default: null }, // Cloudinary public_id for image management
      marks: { type: Number, default: 1 } // Marks for this question
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
QuizSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Quiz = mongoose.model("Quiz", QuizSchema);
module.exports = Quiz;
