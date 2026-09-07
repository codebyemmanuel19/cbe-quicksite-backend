const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

// --- ➕ 1. Create a new client registration ---
router.post("/", async (req, res) => {
  const { business_name, slug, email, password } = req.body;

  try {
    // Hash the password before saving it — never store plain text
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO clients (business_name, slug, email, password)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [business_name, slug, email, hashedPassword]
    );

    const { password: _, ...safeClient } = result.rows[0];
    res.json({ success: true, client: safeClient });
  } catch (err) {
    console.error("Error creating new client record:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 📋 2. Get all clients ---
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients ORDER BY id DESC");
    // Strip passwords from every client in the list
    const safeClients = result.rows.map(({ password, ...rest }) => rest);
    res.json({ success: true, clients: safeClients });
  } catch (err) {
    console.error("Error fetching clients:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔍 3. Get a client profile by their unique URL subdomain slug ---
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

    const rawClientData = result.rows[0];

    // Strip the password before ever sending this response
    const { password: _, ...safeClientData } = rawClientData;

    const standardizedClient = {
      ...safeClientData,
      status: rawClientData.status || "ACTIVE"
    };

    res.json({ success: true, client: standardizedClient });
  } catch (err) {
    console.error(`Error querying client data for slug [${slug}]:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 🔐 4. Client login — verify email + password ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM clients WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const client = result.rows[0];

    // Compare the typed password against the stored hash
    const passwordMatches = await bcrypt.compare(password, client.password);

    if (!passwordMatches) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }

    const { password: _, ...safeClient } = client;

    res.json({ success: true, client: safeClient });
  } catch (err) {
    console.error("Error during client login:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ✏️ 5. Update a client's own profile ---
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    business_name,
    about_text,
    phone,
    email,
    address,
    logo_url,
    hero_url,
    social_facebook,
    social_instagram,
    social_whatsapp,
    social_tiktok,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE clients
       SET business_name = $1, about_text = $2, phone = $3, email = $4, address = $5,
           logo_url = $6, hero_url = $7, social_facebook = $8, social_instagram = $9,
           social_whatsapp = $10, social_tiktok = $11
       WHERE id = $12
       RETURNING *`,
      [
        business_name,
        about_text,
        phone,
        email,
        address,
        logo_url,
        hero_url,
        social_facebook,
        social_instagram,
        social_whatsapp,
        social_tiktok,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    const { password: _, ...safeClient } = result.rows[0];
    res.json({ success: true, client: safeClient });
  } catch (err) {
    console.error("Error updating client:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;