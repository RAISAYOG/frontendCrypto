const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Wallet = require("../models/Wallet"); // Import Wallet model

const { fetchuser } = require("../middleware/fetchuser");

router.post("/dashboard", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user data excluding password and mobile number
    const userData = await User.findById(userId).select("-password -mob");

    // Fetch wallet address associated with the user
    const walletData = await Wallet.findOne({ UserId: userId });

    if (!userData || !walletData) {
      return res.status(404).json({ error: "User or wallet not found" });
    }

    // Extract relevant data from user and wallet documents
    const { _id, first_name, last_name, email } = userData;
    const { WalletAddress } = walletData;

    // Construct the response object
    const responseData = {
      UserId: _id,
      Name: `${first_name} ${last_name}`,
      Email: email,
      WalletAddress: WalletAddress,
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
