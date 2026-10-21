// PLACEHOLDER ROUTER — matchRoutes
//
// This file exists only so server.js can require() it without crashing
// while we build the real routes one at a time. Every request to this
// router currently returns 501 Not Implemented instead of doing anything
// real. Replace the contents of this file when we build matchRoutes for real.
//
// Note: router.use() with no path (rather than router.all('*', ...)) is
// used here because Express 5 removed support for bare '*' wildcards in
// path strings — router.use() without a path always matches everything,
// so it still works as a catch-all.

const express = require('express');
const router = express.Router();

router.use((req, res) => {
  res.status(501).json({ error: 'matchRoutes is not implemented yet.' });
});

module.exports = router;