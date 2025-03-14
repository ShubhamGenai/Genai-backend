const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    qualification: { type: String, trim: true,  },
    interests: { type: [String], trim: true },
    contact: { type: String, trim: true }, // Optional contact number
  
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", StudentSchema);
module.exports = Student;
