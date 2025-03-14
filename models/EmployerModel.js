const mongoose = require("mongoose");

const EmployerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    companyName: { type: String,  },
    domain: { type: String, },
    isDomainVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Employer = mongoose.model("Employer", EmployerSchema);
module.exports = Employer;
