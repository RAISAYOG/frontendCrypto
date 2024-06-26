const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtSecret = "abcdefghijklmnopqrstuvwxyz";

const { body, validationResult } = require("express-validator");

router.post(
  "/Signup",
  body("email", "invalid email").isEmail(),
  body("password", "too small").isLength({ min: 5 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const username = req.body.email;
      const pswd = req.body.password;
      const userdata = await User.findOne({ email: username });

      if (!userdata) {
        return res.status(400).json({ message: "No such user found" });
      }

      const comparepswd = await bcrypt.compare(pswd, userdata.password);
      if (!comparepswd) {
        return res.status(400).json({ message: "Incorrect password" });
      }

      const data = {
        user: {
          id: userdata._id,
        },
      };
      const authToken = jwt.sign(data, jwtSecret);

      res.send({
        userdata: {
          _id: userdata._id,
          walletAddress: userdata.walletAddress,
        },
        authToken,
      });
    } catch (error) {
      console.log(error);
      res.status(500).send("Internal Server Error");
    }
  }
);

module.exports = router;
