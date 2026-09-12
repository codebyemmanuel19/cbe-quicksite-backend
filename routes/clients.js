const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;
const TEMPLATES = ["shop", "realestate"];

// Anything typed with a capital letter, a space, or the full domain still matches
function cleanSlug(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\.cbequicksite\.com$/, "")
    .replace(/[^a-z0-9-]/g, "");
}

function cleanTemplate(input) {
  const value = String(input || "").trim().toLowerCase();
  return TEMPLATES.includes(value) ? value : "shop";
}

// --- ➕ 1. Create a new client registration ---
router.post("/", async (req, res) => {
  const { business_name, email, password, template_type } = req.body;

  const slug = cleanSlug(req.body.slug);
  if (!slug) {
    return res.status(400).json({ success: false, error: "Invalid slug" });
  }

  try {
    // Hash the password before saving it — never store plain text
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO clients (business_name, slug, email, password, template_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [business_name, slug, email, hashedPassword, cleanTemplate(template_type)]
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

// --- 🔐 3. Client login — verify email + password ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM clients WHERE LOWER(email) = LOWER($1)",
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

// --- 🔍 4. Get a client profile by their unique URL subdomain slug ---
router.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    // LOWER on both sides, so one capital letter never breaks a live site
    const result = await pool.query(
      "SELECT * FROM clients WHERE LOWER(slug) = LOWER($1)",
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
      status: rawClientData.status || "ACTIVE",
      template_type: rawClientData.template_type || "shop",
    };

    res.json({ success: true, client: standardizedClient });
  } catch (err) {
    console.error(`Error querying client data for slug [${slug}]:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ✏️ 5. Update a client's own profile ---
// template_type is deliberately not here — a client can't switch their own
// site type, and leaving it out means a dashboard save can never wipe it.
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    business_name,
    home_text,
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
       SET business_name = $1, home_text = $2, about_text = $3, phone = $4, email = $5, address = $6,
           logo_url = $7, hero_url = $8, social_facebook = $9, social_instagram = $10,
           social_whatsapp = $11, social_tiktok = $12
       WHERE id = $13
       RETURNING *`,
      [
        business_name,
        home_text,
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

// --- 🔀 6. Switch a client's template (you, not the client) ---
router.put("/:id/template", async (req, res) => {
  const { id } = req.params;
  const template = cleanTemplate(req.body.template_type);

  try {
    const result = await pool.query(
      "UPDATE clients SET template_type = $1 WHERE id = $2 RETURNING *",
      [template, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    const { password: _, ...safeClient } = result.rows[0];
    res.json({ success: true, client: safeClient });
  } catch (err) {
    console.error("Error updating template type:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;