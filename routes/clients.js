const express = require("express");
const router = express.Router();
const pool = require("../db");

// --- ➕ 1. Create a new client registration ---
router.post("/", async (req, res) => {
  const { business_name, slug, email, password } = req.body;

  try {
    // 💡 PRODUCTION UPGRADE NOTE: Before moving out of MVP testing, 
    // we will hash this password string with bcrypt so it's safely encrypted!
    const result = await pool.query(
      `INSERT INTO clients (business_name, slug, email, password)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [business_name, slug, email, password]
    );
    res.json({ success: true, client: result.rows[0] });
  } catch (err) {
    console.error("Error creating new client record:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔍 2. Get a client profile by their unique URL subdomain slug ---
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM clients WHERE slug = $1",
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Client profile not found" });
    }

    // Capture the record cleanly from the database rows array
    const rawClientData = result.rows[0];

    // Crucial Business Logic: Ensures the frontend app receives an active subscription token state
    const standardizedClient = {
      ...rawClientData,
      status: rawClientData.status || "ACTIVE" 
    };

    res.json({ success: true, client: standardizedClient });
  } catch (err) {
    console.error(`Error querying client data for slug [${slug}]:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;