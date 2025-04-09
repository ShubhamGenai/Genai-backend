const mongoose = require("mongoose");
const { Schema, Types } = mongoose;

const CartSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
      unique: true, // One cart per student
    },
    courses: [
      {
        courseId: { type: Types.ObjectId, ref: "Course" },
        addedAt: { type: Date, default: Date.now }
      }
    ],
    tests: [
      {
        testId: { type: Types.ObjectId, ref: "Test" },
        addedAt: { type: Date, default: Date.now }
      }
    ]
  },

  { timestamps: true }
);

const Cart = mongoose.model("Cart", CartSchema);
module.exports = Cart;
