const express = require("express");
const router = express.Router();
const pool = require("../db");

// Create a new listing for a client
router.post("/", async (req, res) => {
  const { client_id, title, description, media_url, price } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO listings (client_id, title, description, media_url, price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [client_id, title, description, media_url, price]
    );
    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all listings for a specific client
router.get("/client/:client_id", async (req, res) => {
  const { client_id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM listings WHERE client_id = $1 ORDER BY created_at DESC",
      [client_id]
    );
    res.json({ success: true, listings: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;