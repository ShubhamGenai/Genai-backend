const mongoose = require("mongoose");

const LibraryClassSchema = new mongoose.Schema(
  {
    // Internal unique key (lowercase) for case-insensitive uniqueness
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true
    },
    // Display label shown in UI (e.g. "Class 11", "Class 12", "Common")
    displayName: {
      type: String,
      required: true,
      trim: true
    },
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
LibraryClassSchema.index({ name: 1 });

const LibraryClass = mongoose.model("LibraryClass", LibraryClassSchema);
module.exports = LibraryClass;

