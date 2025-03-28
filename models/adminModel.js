const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    fullName: { type: String },

    // Permissions & Status
    permissions: {
      manageUsers: { type: Boolean, default: false },
      manageCourses: { type: Boolean, default: false },
      manageTests: { type: Boolean, default: false },
      managePayments: { type: Boolean, default: false },
    },
    
    isActive: { type: Boolean, default: true },


    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Admin = mongoose.model("Admin", AdminSchema);
module.exports = Admin;
