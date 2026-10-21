// routes/authRoutes.js
//
// Handles the three things needed before ANY other part of the app can
// work: creating an account, logging in, and logging out.
//
// Mounted in server.js as: app.use('/api/auth', authRoutes)
// So the full paths are:
//   POST /api/auth/register
//   POST /api/auth/login
//   POST /api/auth/logout

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
// How long a login stays valid before the student/instructor has to log
// in again. Assumption: 1 day is reasonable for a classroom tool used
// across multiple sessions — adjust if you want shorter-lived tokens.
const TOKEN_EXPIRY = '1d';

const VALID_ROLES = ['student', 'instructor'];

/**
 * POST /api/auth/register
 * Body: { username, email, password, role }
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // ---- Validation first, before touching the database at all ----
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'username, email, password, and role are all required.' });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    // ---- Check for existing username/email BEFORE inserting ----
    // We check this ourselves (rather than only relying on the UNIQUE
    // constraint in the schema) so we can return a clear, specific error
    // message instead of a raw Postgres constraint-violation error.
    const existing = await query(
      'SELECT user_id FROM "User" WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That username or email is already registered.' });
    }

    // ---- Hash the password — NEVER store plaintext passwords ----
    // 10 salt rounds is the standard default: strong enough for this use
    // case without being noticeably slow on login/register requests.
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO "User" (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, username, email, role, created_at`,
      [username, email, passwordHash, role]
    );

    const newUser = result.rows[0];

    // Log them in immediately after registering, so the frontend doesn't
    // need a separate "now go log in" step.
    const token = jwt.sign(
      { id: newUser.user_id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: newUser // safe to return — no password_hash included
    });
  } catch (err) {
    // Anything unexpected (DB connection dropped, etc.) goes to the
    // central error handler in server.js instead of crashing here.
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { identifier, password }
 * `identifier` can be either a username or an email — this keeps the
 * frontend login form simple (one field instead of two).
 */
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password are required.' });
    }

    const result = await query(
      'SELECT user_id, username, email, password_hash, role FROM "User" WHERE username = $1 OR email = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      // Deliberately vague — "user not found" vs "wrong password" should
      // look identical to the client. Telling an attacker which one
      // failed makes it easier to guess valid usernames/emails.
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.json({
      message: 'Logged in successfully.',
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * With JWT, the server doesn't actually "hold" a session to destroy —
 * the token is self-contained proof of login. Logging out just means the
 * frontend deletes its stored token. This endpoint exists mainly so the
 * frontend has a consistent API to call, and so we have one place to add
 * real token invalidation (e.g. a blocklist table) later if it's ever
 * needed — not required for this project's scope right now.
 */
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out. Please discard your token on the client.' });
});

module.exports = router;