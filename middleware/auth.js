const jwt = require("jsonwebtoken");

// Reads the token from the Authorization header and puts the client on req.user.
// Any route using this is closed to anyone without a valid login.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: "Not signed in" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Session expired. Please log in again." });
  }
}

// Only the admin account — client list, creating clients, switching templates
function requireAdmin(req, res, next) {
  if (!req.user || req.user.is_admin !== true) {
    return res.status(403).json({ success: false, error: "Not allowed" });
  }
  next();
}

// The id in the URL must match the id in the token (admin can touch anything).
// This is what stops someone changing 9 to 12 and editing another client.
function requireSelfOrAdmin(req, res, next) {
  const urlId = String(req.params.id);
  const tokenId = String(req.user && req.user.id);

  if (req.user && req.user.is_admin === true) return next();

  if (urlId !== tokenId) {
    return res.status(403).json({ success: false, error: "Not allowed" });
  }

  next();
}

module.exports = { requireAuth, requireAdmin, requireSelfOrAdmin };