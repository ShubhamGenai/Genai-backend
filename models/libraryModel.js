const mongoose = require("mongoose");

const LibraryDocumentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { 
      actual: { type: Number, required: true },
      discounted: { type: Number, required: true }
    },
    fileUrl: { type: String, required: true }, // URL to the uploaded PDF file
    fileName: { type: String, required: true }, // Original file name
    fileSize: { type: Number }, // File size in bytes
    class: { type: String, required: true, trim: true }, // e.g., "Class 11", "Class 12", "Common"
    category: { type: String, required: true, trim: true }, // e.g., "Physics", "Biology", "English"
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Content manager who uploaded
    downloads: { type: Number, default: 0 }, // Track download count
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const LibraryDocument = mongoose.model("LibraryDocument", LibraryDocumentSchema);
module.exports = LibraryDocument;
