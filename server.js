// server.js
//
// This is the "ON switch" for the whole app. Its job:
//   1. Load environment variables (.env)
//   2. Set up Express (handles normal HTTP requests: login, fetching a
//      dashboard, submitting an answer, etc.)
//   3. Wrap Express in a plain Node http.Server, because Socket.IO needs
//      to attach itself to that raw server, not to Express directly.
//   4. Set up Socket.IO on top of that server (handles real-time stuff:
//      live race progress, leaderboard updates)
//   5. Mount all the route files so each URL prefix goes to the right file
//   6. Serve the frontend (public/pages, public/js)
//   7. Catch errors in one place, so nothing leaks a raw stack trace to users
//   8. Start listening on a port

require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const { testConnection } = require("./config/db");

// --- These route files are part of the skeleton but not built yet. ---
// Requiring them now means `node server.js` WILL crash until each one
// exists and exports an Express router. That's expected at this stage —
// we're wiring server.js correctly ahead of time. If you want to test
// that the server boots before those files exist, ask me for quick
// placeholder ("not implemented yet") versions of each route file.
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const instructorRoutes = require("./routes/instructorRoutes");
const classRoutes = require("./routes/classRoutes");
const questionRoutes = require("./routes/questionRoutes");
const matchRoutes = require("./routes/matchRoutes");
const evaluationRoutes = require("./routes/evaluationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const registerMatchSocket = require("./sockets/matchSocket");

const app = express();

// http.createServer wraps our Express app in a raw Node server object.
// We need this specific object (not just `app`) because Socket.IO attaches
// its WebSocket upgrade logic directly onto it.
const server = http.createServer(app);

// Socket.IO server, attached to the same underlying HTTP server as Express.
// This lets normal page loads (HTTP) and real-time race updates (WebSocket)
// share one port instead of running two separate servers.
const io = new Server(server, {
  cors: {
    // Same-origin by default since we serve the frontend from this same
    // Express app. If you ever split the frontend to its own domain/port
    // during development, set CLIENT_ORIGIN in .env and this will allow it.
    origin: process.env.CLIENT_ORIGIN || "*",
  },
});

// ---------- Core middleware ----------

// Parses incoming JSON request bodies (e.g. { "username": "...", "password": "..." })
// into req.body, so route handlers can just read req.body.username.
app.use(express.json());

// Parses traditional HTML form submissions (application/x-www-form-urlencoded).
// Harmless to keep even if you mostly send JSON from the frontend JS.
app.use(express.urlencoded({ extended: true }));

// Serves your frontend files directly. Because index.html lives in
// public/pages, and your JS lives in public/js, we expose both folders
// so a browser can request /pages/index.html and /js/app.js.
app.use("/pages", express.static(path.join(__dirname, "public/pages")));
app.use("/js", express.static(path.join(__dirname, "public/js")));

// So visiting http://localhost:PORT/ directly opens the login/register page
// instead of showing "Cannot GET /".
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/pages/index.html"));
});

// ---------- API routes ----------
// Each route file only has to define routes RELATIVE to its prefix.
// e.g. inside authRoutes.js, router.post('/login', ...) becomes
// POST /api/auth/login once mounted here.
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/instructor", instructorRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/evaluation", evaluationRoutes);
app.use("/api/analytics", analyticsRoutes);

// ---------- Real-time (Socket.IO) ----------
// All the "on connection, on answer submitted, broadcast leaderboard"
// logic lives in sockets/matchSocket.js. We just hand it the `io` instance
// here so that file can register its own event listeners.
registerMatchSocket(io);

// ---------- 404 handler ----------
// If a request doesn't match any route above (bad URL, typo, etc.), this
// catches it and returns a clean JSON 404 instead of Express's default
// HTML error page.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------- Central error handler ----------
// Any route that does `next(err)`, or any middleware that throws, ends up
// here instead of crashing the process or leaking a raw stack trace to
// the client. This is also where we fix the "raw 500 on missing join
// code" issue from classRoutes.js later — that route should call
// next(err) with a proper status/message instead of letting an unhandled
// error bubble up.
app.use((err, req, res, next) => {
  console.error(err.stack);

  const status = err.status || 500;
  const message =
    status === 500 ? "Something went wrong on our end." : err.message;

  res.status(status).json({ error: message });
});

// ---------- Start the server ----------
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // Fail loudly and immediately if the DB is unreachable, instead of
    // starting a server that will error on the very first request.
    await testConnection();

    server.listen(PORT, () => {
      console.log(`Race by Code server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(
      "Failed to start server — could not connect to database:",
      err.message,
    );
    process.exit(1);
  }
}

start();
