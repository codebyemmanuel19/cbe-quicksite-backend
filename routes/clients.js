const express = require("express");
const router = express.Router();
const pool = require("../db");

// Create a new client
router.post("/", async (req, res) => {
  const { business_name, slug, email, password } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO clients (business_name, slug, email, password)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [business_name, slug, email, password]
    );
    res.json({ success: true, client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get a client by slug
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM clients WHERE slug = $1",
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    res.json({ success: true, client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;