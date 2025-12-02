const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }], // References Lesson Model
  createdAt: { type: Date, default: Date.now }

});

const Module = mongoose.model("Module", ModuleSchema);
module.exports = Module;
