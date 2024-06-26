const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    default: 100000,
  },
  invested: {
    type: Number,
    default: 0,
  },
  walletAddress: {
    type: String,
    unique: true,
    required: true,
  },
});

module.exports = mongoose.model("Wallet", walletSchema);
