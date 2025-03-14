const mongoose = require("mongoose");

const WhitelistSchema = new mongoose.Schema({
  domain: { type: String, unique: true, required: true },
  approved: { type: Boolean, default: false },
});

const Whitelist = mongoose.model("Whitelist", WhitelistSchema);
module.exports = Whitelist;
