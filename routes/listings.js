const express = require("express");
const router = express.Router();
const pool = require("../db");

// --- ➕ 1. Create a new listing / product for a client ---
router.post("/", async (req, res) => {
  const { client_id, title, description, media_url, media_urls, price } = req.body;

  // Crucial Upgrade: If the client passes a list of images, we use that. 
  // Otherwise, we wrap their single image link into an array structure for the slider.
  const finalMediaUrls = media_urls && Array.isArray(media_urls)
    ? media_urls
    : [media_url || "https://unsplash.com"];

  try {
    const result = await pool.query(
      `INSERT INTO listings (client_id, title, description, media_urls, price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [client_id, title, description, finalMediaUrls, price]
    );
    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    console.error("Error creating listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔍 2. Get all listings for a specific client ---
router.get("/client/:client_id", async (req, res) => {
  const { client_id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM listings WHERE client_id = $1 ORDER BY id DESC",
      [client_id]
    );

    // Standardize rows array data to match the frontend keys completely
    const formattedListings = result.rows.map((row) => ({
      ...row,
      // Map old database entry fields to new array keys if necessary
      media_urls: row.media_urls || [row.media_url].filter(Boolean)
    }));

    res.json({ success: true, listings: formattedListings });
  } catch (err) {
    console.error(`Error querying listings for client ID [${client_id}]:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;