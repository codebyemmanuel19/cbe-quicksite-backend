const express = require("express");
const cors = require("cors");
const pool = require("./db");
const clientRoutes = require("./routes/clients");
const listingRoutes = require("./routes/listings");

const app = express();

// Enable Cross-Origin Resource Sharing so your Vercel frontend can talk to your Render backend
app.use(cors());
app.use(express.json());

// Root test path to confirm server health
app.get("/", (req, res) => {
  res.send("CBE QuickSite backend is running beautifully!");
});

// Database check route — visit http://localhost:5000/test-db on your laptop screen to verify postgres
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    console.error("Database connection failure:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route mount managers
app.use("/clients", clientRoutes);
app.use("/listings", listingRoutes);

// Crucial Upgrade: Allows Render to inject its own server port live, or falls back to local port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Production server operational on port ${PORT}`);
});