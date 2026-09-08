const express = require("express");
const router = express.Router();
const pool = require("../db");

const MAX_IMAGES = 4;

// Keeps at most 4 real image URLs — no fake fallback link
function cleanMediaUrls(media_urls, media_url) {
  const list = Array.isArray(media_urls)
    ? media_urls
    : media_url
    ? [media_url]
    : [];

  return list
    .filter((url) => typeof url === "string" && url.trim() !== "")
    .slice(0, MAX_IMAGES);
}

// Empty string or undefined means "no stock limit"
function cleanStock(stock) {
  if (stock === null || stock === undefined || stock === "") return null;
  const value = Number(stock);
  if (Number.isNaN(value) || value < 0) return null;
  return Math.floor(value);
}

// --- ➕ 1. Create a new listing / product for a client ---
router.post("/", async (req, res) => {
  const { client_id, title, description, media_url, media_urls, price, stock } = req.body;

  const finalMediaUrls = cleanMediaUrls(media_urls, media_url);
  const finalStock = cleanStock(stock);

  try {
    const result = await pool.query(
      `INSERT INTO listings (client_id, title, description, media_urls, price, stock)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [client_id, title, description, finalMediaUrls, price, finalStock]
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
      media_urls: row.media_urls || [row.media_url].filter(Boolean),
    }));

    res.json({ success: true, listings: formattedListings });
  } catch (err) {
    console.error(`Error querying listings for client ID [${client_id}]:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔎 3. Get one listing by id ---
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM listings WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      listing: { ...row, media_urls: row.media_urls || [row.media_url].filter(Boolean) },
    });
  } catch (err) {
    console.error("Error fetching listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ✏️ 4. Update an existing listing ---
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, media_url, media_urls, price, stock } = req.body;

  const finalMediaUrls = cleanMediaUrls(media_urls, media_url);
  const finalStock = cleanStock(stock);

  try {
    const result = await pool.query(
      `UPDATE listings
       SET title = $1, description = $2, media_urls = $3, price = $4, stock = $5
       WHERE id = $6
       RETURNING *`,
      [title, description, finalMediaUrls, price, finalStock, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    console.error("Error updating listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🗑️ 5. Delete a listing ---
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM listings WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Listing not found" });
    }

    res.json({ success: true, message: "Listing deleted successfully" });
  } catch (err) {
    console.error("Error deleting listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;