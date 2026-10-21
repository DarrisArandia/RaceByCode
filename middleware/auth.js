// middleware/auth.js
//
// Two middleware functions live here:
//   1. requireAuth   — "is this request coming from a logged-in user at all?"
//   2. requireRole    — "is this logged-in user allowed to do THIS specific thing?"
//
// How the flow works end-to-end:
//   1. User logs in via authRoutes.js -> POST /api/auth/login
//   2. authRoutes.js verifies their password, then creates a JWT (a signed,
//      tamper-proof string) containing { id, role }, and sends it back to
//      the frontend as the response.
//   3. The frontend stores that token (e.g. in localStorage) and sends it
//      back on every future request in a header:
//        Authorization: Bearer <token>
//   4. requireAuth (below) reads that header, verifies the token is valid
//      and wasn't tampered with, and attaches the decoded info as
//      req.user = { id, role } so every later route handler can use it.
//
// Why JWT instead of sessions? Socket.IO connections aren't regular HTTP
// requests with cookies attached the same way — passing the same token
// used for API calls to authenticate a socket connection is simpler than
// wiring up shared session storage between Express and Socket.IO.

const jwt = require('jsonwebtoken');

// This MUST be set in your .env file, e.g.:
//   JWT_SECRET=some_long_random_string_no_one_can_guess
// Never hard-code a real secret here. If this leaks, anyone can forge a
// valid login token for any user/role.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined` as the secret, which would be a serious security hole.
  throw new Error('JWT_SECRET is not set in .env — auth middleware cannot start without it.');
}

/**
 * requireAuth
 * Blocks the request with 401 Unauthorized unless a valid token is present.
 * On success, attaches req.user = { id, role, ...whatever else you put in the token }
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // expected format: "Bearer <token>"

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // throws if invalid/expired/tampered
    req.user = decoded; // e.g. { id: 12, role: 'student', iat: ..., exp: ... }
    next(); // token is good — let the actual route handler run
  } catch (err) {
    // Covers both "signature doesn't match" (tampered/forged) and
    // "token expired" — jwt.verify throws for both, with different
    // err.name values (JsonWebTokenError vs TokenExpiredError) if you
    // ever want to give the frontend a more specific message.
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

/**
 * requireRole(...allowedRoles)
 * Use AFTER requireAuth in the middleware chain, since it depends on
 * req.user already being set.
 *
 * Example usage in a route file:
 *   router.post('/classes', requireAuth, requireRole('instructor'), createClass);
 *
 * This blocks a logged-in student from hitting instructor-only routes,
 * even if they have a perfectly valid token — the role just isn't allowed.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Defensive check — this should never trigger if requireRole is
      // always used after requireAuth, but it prevents a confusing crash
      // if someone forgets the ordering later.
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };