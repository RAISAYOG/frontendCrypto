const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Import User model
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtSecret = "abcdefghijklmnopqrstuvwxyz";

// Function to generate a random 6-digit user ID
const generateUserId = async () => {
  let userId;
  let userExists;
  do {
    userId = Math.floor(100000 + Math.random() * 900000).toString();
    userExists = await User.findOne({ userId });
  } while (userExists);
  return userId;
};

// Function to generate a random 12-character wallet address
const generateWalletAddress = async () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let walletAddress;
  let addressExists;
  do {
    walletAddress = "";
    for (let i = 0; i < 12; i++) {
      walletAddress += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    addressExists = await User.findOne({ walletAddress });
  } while (addressExists);
  return walletAddress;
};

router.post(
  "/createuser",
  body("email", "Invalid email").isEmail(),
  body("password", "Password too short").isLength({ min: 5 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const salt = await bcrypt.genSalt(10);
      const securePassword = await bcrypt.hash(req.body.password, salt);

      const existingUser = await User.findOne({ email: req.body.email });
      if (existingUser) {
        return res.status(400).json({ success: false, userExist: true });
      }

      const userId = await generateUserId();
      const walletAddress = await generateWalletAddress();

      const user = new User({
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        age: req.body.age,
        mob: req.body.mob,
        email: req.body.email,
        password: securePassword,
        userId: userId,
        walletAddress: walletAddress,
      });
      await user.save();

      const data = {
        user: {
          id: user._id,
        },
      };
      const authToken = jwt.sign(data, jwtSecret);

      res.json({
        success: true,
        userExist: false,
        authToken,
        userdata: { _id: user._id, walletAddress: user.walletAddress },
      });
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
  }
);

module.exports = router;
