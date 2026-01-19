const mongoose = require("mongoose");

const LibraryCategorySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      unique: true,
      lowercase: true // Store lowercase for case-insensitive uniqueness
    },
    displayName: { 
      type: String, 
      required: true, 
      trim: true 
    }, // Original case for display
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

// Index for faster lookups
LibraryCategorySchema.index({ name: 1 });

const LibraryCategory = mongoose.model("LibraryCategory", LibraryCategorySchema);
module.exports = LibraryCategory;
