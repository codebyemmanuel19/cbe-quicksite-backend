const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireAuth } = require("../middleware/auth");

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

// Extra fields per template — property specs today, other niches later.
// Empty values are dropped so the site never renders a blank spec.
function cleanDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;

  const cleaned = {};
  Object.entries(details).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text !== "") cleaned[key] = text;
  });

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

// Looks up who owns a listing and refuses anyone else.
// This is the check that stops 45 → 46 reaching another client's product.
async function loadOwnedListing(req, res) {
  const { id } = req.params;

  const found = await pool.query("SELECT client_id FROM listings WHERE id = $1", [id]);

  if (found.rows.length === 0) {
    res.status(404).json({ success: false, error: "Listing not found" });
    return null;
  }

  const ownerId = found.rows[0].client_id;

  if (req.user.is_admin !== true && String(ownerId) !== String(req.user.id)) {
    res.status(403).json({ success: false, error: "Not allowed" });
    return null;
  }

  return ownerId;
}

// --- ➕ 1. Create a listing — always filed under the logged-in client ---
router.post("/", requireAuth, async (req, res) => {
  const { title, description, media_url, media_urls, price, stock, details } = req.body;

  // client_id comes from the token, never from the request body.
  // Admin can still post on a client's behalf by sending client_id.
  const clientId =
    req.user.is_admin === true && req.body.client_id
      ? req.body.client_id
      : req.user.id;

  const finalMediaUrls = cleanMediaUrls(media_urls, media_url);
  const finalStock = cleanStock(stock);
  const finalDetails = cleanDetails(details);

  try {
    const result = await pool.query(
      `INSERT INTO listings (client_id, title, description, media_urls, price, stock, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [clientId, title, description, finalMediaUrls, price, finalStock, finalDetails]
    );
    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    console.error("Error creating listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔍 2. Get all listings for a client — public, the live sites need it ---
router.get("/client/:client_id", async (req, res) => {
  const { client_id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM listings WHERE client_id = $1 ORDER BY id DESC",
      [client_id]
    );

    const formattedListings = result.rows.map((row) => ({
      ...row,
      media_urls: row.media_urls || [row.media_url].filter(Boolean),
      details: row.details || {},
    }));

    res.json({ success: true, listings: formattedListings });
  } catch (err) {
    console.error(`Error querying listings for client ID [${client_id}]:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔎 3. Get one listing by id — public ---
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
      listing: {
        ...row,
        media_urls: row.media_urls || [row.media_url].filter(Boolean),
        details: row.details || {},
      },
    });
  } catch (err) {
    console.error("Error fetching listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ✏️ 4. Update a listing — must be yours ---
router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, description, media_url, media_urls, price, stock, details } = req.body;

  const finalMediaUrls = cleanMediaUrls(media_urls, media_url);
  const finalStock = cleanStock(stock);
  const finalDetails = cleanDetails(details);

  try {
    const owner = await loadOwnedListing(req, res);
    if (owner === null) return;

    const result = await pool.query(
      `UPDATE listings
       SET title = $1, description = $2, media_urls = $3, price = $4, stock = $5, details = $6
       WHERE id = $7
       RETURNING *`,
      [title, description, finalMediaUrls, price, finalStock, finalDetails, id]
    );

    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    console.error("Error updating listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🗑️ 5. Delete a listing — must be yours ---
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const owner = await loadOwnedListing(req, res);
    if (owner === null) return;

    await pool.query("DELETE FROM listings WHERE id = $1", [id]);

    res.json({ success: true, message: "Listing deleted successfully" });
  } catch (err) {
    console.error("Error deleting listing:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;