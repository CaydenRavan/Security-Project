const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const protectedRoutes = require("./routes/protected");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("MFA server is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/protected", protectedRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
