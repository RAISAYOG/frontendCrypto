const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { header } = require("express-validator");
const dashboardRouter = require("./Routes/Dashboard");
const cors = require("cors");
const app = express();

app.use(bodyParser.json({ limit: "30mb", extended: true }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());
//---------------mongoose connection----------------//

const Connection_url =
  "mongodb+srv://prabesh:prabesh@fyp.ubddnoe.mongodb.net/Crypto?retryWrites=true&w=majority";
const PORT = 3001;

mongoose
  .connect(Connection_url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`running on ${PORT}`)))
  .catch((error) => console.log(error.message));

mongoose.set("strictQuery", true);
console.log(PORT);
//---------------mongoose connection----------------//

// Routes for backend calls

app.use(express.json());
app.use("/dashboard", dashboardRouter);
app.use("/dashboard", require("./Routes/Userdetails"));
app.use("/dashboard", require("./Routes/ProfileUpdate"));

app.use("/register", require("./Routes/CreatUser"));
app.use("/register", require("./Routes/Signup"));

app.use("/transactions", require("./Routes/Transactions"));
app.use("/wallet", require("./Routes/Wallet"));
