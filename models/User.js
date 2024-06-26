const mongoose = require("mongoose");
require("mongoose-type-email");

const userSchema = new mongoose.Schema({
  first_name: {
    type: String,
    required: true,
    maxLength: 50,
  },
  last_name: {
    type: String,
    required: true,
    maxLength: 50,
  },
  age: {
    type: Number,
    required: true,
  },
  mob: {
    type: Number,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensure email is unique
  },
  password: {
    type: String,
    minLength: 5,
    required: true,
  },
  userId: {
    type: String,
    unique: true,
    required: true,
  },
  walletAddress: {
    type: String,
    unique: true, // Ensure wallet address is unique
    required: true,
  },
});

module.exports = mongoose.model("User", userSchema);
