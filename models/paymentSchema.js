const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test" },
    course: { type: mongoose.Schema.Types.ObjectId, ref: "course" },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
