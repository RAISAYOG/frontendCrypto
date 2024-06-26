const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { header } = require("express-validator");
const dashboardRouter = require("./Routes/Dashboard");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const axios = require("axios");

const app = express();

// Body Parser Middleware
app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB connection
const Connection_url =
  "mongodb+srv://prabesh:prabesh@fyp.ubddnoe.mongodb.net/Crypto?retryWrites=true&w=majority";
const PORT = 3001;

mongoose
  .connect(Connection_url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() =>
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
  )
  .catch((error) => console.log(error.message));

mongoose.set("strictQuery", true);

// Routes for backend calls
app.use("/dashboard", dashboardRouter);
app.use("/dashboard", require("./Routes/Userdetails"));
app.use("/dashboard", require("./Routes/ProfileUpdate"));

app.use("/register", require("./Routes/CreatUser"));
app.use("/register", require("./Routes/Signup"));

app.use("/transactions", require("./Routes/Transactions"));
app.use("/wallet", require("./Routes/Wallet"));

// Define Schemas and Models
const predictionSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  direction: { type: String, required: true },
  amount: { type: Number, required: true },
  deliveryTime: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  predictedAt: { type: Date, default: Date.now },
  fee: { type: Number, required: true },
  result: { type: Object, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  walletAddress: { type: String, required: true },
});
const Prediction = mongoose.model("Prediction", predictionSchema);

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
  },
  balances: { type: Map, of: Number, default: { usd: 0 } },
});
const Wallet = mongoose.model("Wallet", walletSchema);

const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  amount: { type: Number, required: true },
  proof: { type: String, required: true },
  approved: { type: Boolean, default: false },
});
const Deposit = mongoose.model("Deposit", depositSchema);

const withdrawSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  symbol: { type: String, required: true },
  amount: { type: Number, required: true },
  approved: { type: Boolean, default: false },
});
const Withdraw = mongoose.model("Withdraw", withdrawSchema);

const sendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  symbol: { type: String, required: true },
  amount: { type: Number, required: true },
  address: { type: String, required: true },
  status: { type: String, default: "pending" },
});
const Send = mongoose.model("Send", sendSchema);

const deliveryTimes = [
  { time: 60, interest: 0.1, minAmount: 20 },
  { time: 600, interest: 0.3, minAmount: 50 },
  { time: 3600, interest: 0.5, minAmount: 100 },
  { time: 86400, interest: 1.0, minAmount: 200 },
];

// Fetch current prices in USD
app.get("/api/prices", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/coins/markets",
      {
        params: {
          vs_currency: "usd",
          order: "market_cap_desc",
          per_page: 250,
          page: 1,
          sparkline: true,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching prices:", error);
    res.status(500).json({ error: error.message });
  }
});

// Place a prediction
app.post("/api/predict", async (req, res) => {
  const { symbol, direction, amount, deliveryTime, userId, walletAddress } =
    req.body;

  const selectedTime = deliveryTimes.find((time) => time.time === deliveryTime);

  if (!selectedTime) {
    return res.status(400).json({ error: "Invalid delivery time selected." });
  }

  if (amount < selectedTime.minAmount) {
    return res.status(400).json({
      error: `Minimum amount for this delivery time is ${selectedTime.minAmount}`,
    });
  }

  // Fetch the current price of the cryptocurrency
  const response = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price`,
    {
      params: {
        ids: symbol,
        vs_currencies: "usd",
      },
    }
  );

  const cryptoPrice = response.data[symbol].usd;
  const cryptoAmount = amount / cryptoPrice;

  // Check if user has enough balance in USD
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.balances.get("usd") < amount) {
    return res.status(400).json({ error: "Insufficient USD balance." });
  }

  const prediction = new Prediction({
    symbol,
    direction,
    amount,
    deliveryTime,
    currentPrice: cryptoPrice,
    predictedAt: Date.now(),
    fee: amount * 0.001,
    userId,
    walletAddress,
  });

  try {
    // Deduct the USD amount from the user's wallet
    wallet.balances.set("usd", wallet.balances.get("usd") - amount);
    await wallet.save();

    await prediction.save();
    console.log("Prediction saved:", prediction);

    setTimeout(async () => {
      try {
        const result = await evaluatePrediction(
          prediction._id,
          selectedTime.interest
        );
        console.log("Evaluation result:", result);
      } catch (error) {
        console.error("Error evaluating prediction:", error);
      }
    }, deliveryTime * 1000);

    res.json(prediction);
  } catch (error) {
    console.error("Error saving prediction:", error);
    res.status(500).json({ error: error.message });
  }
});

const evaluatePrediction = async (predictionId, interestRate) => {
  const prediction = await Prediction.findById(predictionId);
  if (!prediction) throw new Error("Prediction not found");

  const { symbol, direction, amount, currentPrice, fee, result, userId } =
    prediction;

  // If admin has already set a result, use it
  if (result) {
    const profit = result.success ? amount - fee + amount * interestRate : 0;
    const updatedResult = {
      success: result.success,
      profit,
      message: result.success
        ? `Admin approved profit of ${profit}`
        : "Admin approved loss",
    };
    await Prediction.findByIdAndUpdate(predictionId, { result: updatedResult });
    return updatedResult;
  }

  // Evaluate based on actual market conditions if admin has not set a result
  const response = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price`,
    {
      params: {
        ids: symbol,
        vs_currencies: "usd",
      },
    }
  );

  const newPrice = response.data[symbol].usd;

  let evalResult;
  if (
    (direction === "up" && newPrice > currentPrice) ||
    (direction === "down" && newPrice < currentPrice)
  ) {
    const profit = amount - fee + amount * interestRate;
    const cryptoProfit = profit / newPrice;
    evalResult = {
      success: true,
      profit,
      message: `You have earned ${cryptoProfit} ${symbol.toUpperCase()}`,
    };

    // Update the user's wallet with the profit in cryptocurrency
    await Wallet.updateOne(
      { userId },
      { $inc: { [`balances.${symbol}`]: cryptoProfit } },
      { upsert: true }
    );
  } else {
    evalResult = {
      success: false,
      loss: amount,
      message: "You have lost all your money",
    };

    // No need to update the wallet on loss as the amount was already deducted
  }

  // Update the prediction with the evaluated result
  await Prediction.findByIdAndUpdate(predictionId, { result: evalResult });

  return evalResult;
};

// Update prediction result manually
app.post("/api/prediction/:id/result", async (req, res) => {
  const { id } = req.params;
  const { success } = req.body;

  try {
    const prediction = await Prediction.findById(id);
    if (!prediction) {
      return res.status(404).json({ error: "Prediction not found" });
    }

    const profit = success
      ? prediction.amount - prediction.fee + prediction.amount * 0.1
      : 0;
    const cryptoProfit = profit / prediction.currentPrice;
    const result = {
      success,
      amount: prediction.amount,
      profit,
      message: success
        ? `Admin approved profit of ${cryptoProfit} ${prediction.symbol.toUpperCase()}`
        : "Admin approved loss",
    };
    await Prediction.findByIdAndUpdate(id, { result });

    // Update the user's wallet based on the result
    await Wallet.updateOne(
      { userId: prediction.userId },
      {
        $inc: {
          [`balances.${prediction.symbol}`]: success
            ? cryptoProfit
            : -cryptoProfit,
        },
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating prediction result:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch prediction result
app.get("/api/prediction/:id", async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id);
    if (!prediction)
      return res.status(404).json({ error: "Prediction not found" });

    res.json(prediction.result);
  } catch (error) {
    console.error("Error fetching prediction result:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch predictions by user ID
app.get("/api/predictions/user/:userId", async (req, res) => {
  try {
    const predictions = await Prediction.find({ userId: req.params.userId });
    if (!predictions) {
      return res
        .status(404)
        .json({ error: "No predictions found for this user" });
    }
    res.json(predictions);
  } catch (error) {
    console.error("Error fetching predictions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch all waiting predictions
app.get("/api/predictions/waiting", async (req, res) => {
  try {
    const predictions = await Prediction.find({ result: null });
    res.json(predictions);
  } catch (error) {
    console.error("Error fetching waiting predictions:", error);
    res.status(500).json({ error: error.message });
  }
});

// Wallet Routes

// Create or update wallet balance
app.post("/api/wallet", async (req, res) => {
  const { userId, symbol, amount } = req.body;

  try {
    await Wallet.updateOne(
      { userId },
      { $set: { [`balances.${symbol}`]: amount } },
      { upsert: true }
    );
    res.json({ success: true, message: "Wallet balance updated successfully" });
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch wallet by user ID
app.get("/api/wallet/:userId", async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found for this user" });
    }
    res.json(wallet);
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch wallet balances and latest prices in USD/USDT
app.get("/api/wallet/:userId/balances", async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      // Initialize a new wallet with 0 balances for the top 250 cryptocurrencies
      const response = await axios.get(
        "https://api.coingecko.com/api/v3/coins/markets",
        {
          params: {
            vs_currency: "usd",
            order: "market_cap_desc",
            per_page: 250,
            page: 1,
            sparkline: true,
          },
        }
      );

      const coins = response.data;
      const initialBalances = { usd: 0 };
      coins.forEach((coin) => {
        initialBalances[coin.id] = 0;
      });

      wallet = new Wallet({
        userId: req.params.userId,
        balances: initialBalances,
      });
      await wallet.save();
    }

    const symbols = Array.from(wallet.balances.keys());
    if (symbols.length === 0) {
      return res.json({ balances: wallet.balances, prices: {} });
    }

    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price",
      {
        params: {
          ids: symbols.join(","),
          vs_currencies: "usd",
        },
      }
    );

    const prices = response.data;
    res.json({ balances: wallet.balances, prices });
  } catch (error) {
    console.error("Error fetching wallet balances and prices:", error);
    res.status(500).json({ error: error.message });
  }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

// Deposit route
app.post("/api/deposit", upload.single("proof"), async (req, res) => {
  const { userId, amount } = req.body;
  const proof = req.file.path;

  const deposit = new Deposit({
    userId,
    amount,
    proof,
  });

  try {
    await deposit.save();
    res.json({
      success: true,
      message: "Deposit request submitted successfully",
    });
  } catch (error) {
    console.error("Error saving deposit request:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch all deposit requests for admin
app.get("/api/deposits", async (req, res) => {
  try {
    const deposits = await Deposit.find({ approved: false });
    res.json(deposits);
  } catch (error) {
    console.error("Error fetching deposits:", error);
    res.status(500).json({ error: error.message });
  }
});

// Approve deposit request
app.post("/api/deposits/:id/approve", async (req, res) => {
  const { id } = req.params;

  try {
    const deposit = await Deposit.findById(id);
    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    deposit.approved = true;
    await deposit.save();

    await Wallet.updateOne(
      { userId: deposit.userId },
      { $inc: { "balances.usd": deposit.amount } },
      { upsert: true }
    );

    res.json({
      success: true,
      message: "Deposit approved and balance updated",
    });
  } catch (error) {
    console.error("Error approving deposit:", error);
    res.status(500).json({ error: error.message });
  }
});

// Withdraw cryptocurrency and convert to USD
app.post("/api/withdraw", async (req, res) => {
  const { userId, symbol, amount } = req.body;

  try {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balances.get(symbol) < amount) {
      return res
        .status(400)
        .json({ error: "Insufficient balance for withdrawal" });
    }

    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price`,
      {
        params: {
          ids: symbol,
          vs_currencies: "usd",
        },
      }
    );

    const cryptoPrice = response.data[symbol].usd;
    const usdAmount = amount * cryptoPrice;

    // Update the wallet: reduce the cryptocurrency balance and increase the USD balance
    wallet.balances.set(symbol, wallet.balances.get(symbol) - amount);
    wallet.balances.set("usd", wallet.balances.get("usd") + usdAmount);
    await wallet.save();

    res.json({
      success: true,
      message: "Withdrawal completed and USD balance updated",
      usdAmount,
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send cryptocurrency to an address
app.post("/api/send", async (req, res) => {
  const { userId, symbol, amount, address } = req.body;

  try {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balances.get(symbol) < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Create a new send request
    const sendRequest = new Send({
      userId,
      symbol,
      amount,
      address,
      status: "pending",
    });
    await sendRequest.save();

    // Deduct the amount from user's wallet
    wallet.balances.set(symbol, wallet.balances.get(symbol) - amount);
    await wallet.save();

    res.json({
      success: true,
      message: "Send request submitted and pending admin approval",
    });
  } catch (error) {
    console.error("Error creating send request:", error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch all send requests for admin
app.get("/api/send-requests", async (req, res) => {
  try {
    const sendRequests = await Send.find({ status: "pending" });
    res.json(sendRequests);
  } catch (error) {
    console.error("Error fetching send requests:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update send request status
app.post("/api/send-requests/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const sendRequest = await Send.findById(id);
    if (!sendRequest) {
      return res.status(404).json({ error: "Send request not found" });
    }

    sendRequest.status = status;
    await sendRequest.save();

    res.json({ success: true, message: `Send request marked as ${status}` });
  } catch (error) {
    console.error("Error updating send request status:", error);
    res.status(500).json({ error: error.message });
  }
});
