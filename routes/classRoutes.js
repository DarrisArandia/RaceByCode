// routes/classRoutes.js
//
// Handles class creation (instructor) and joining a class by code (student).
//
// Mounted in server.js as: app.use('/api/classes', classRoutes)
// So the full paths are:
//   POST /api/classes            (instructor creates a class)
//   GET  /api/classes            (instructor lists their own classes)
//   POST /api/classes/join       (student joins by code)
//   GET  /api/classes/:id        (view one class's details)
//
// ⚠️ IMPORTANT — read this before touching this file again:
// The schema has NO CLASS_ENROLLMENT table (flagged as a deliberate,
// still-unresolved gap). That means POST /join below can only VALIDATE
// that a join code is real — it CANNOT record "this student is now a
// member of this class" anywhere. There is nowhere to write that fact.
// Actual class membership only becomes visible later, indirectly,
// through MatchParticipant rows once a student joins a private Match
// tied to this class_id. If you ever need "list every student in Class
// X" as a real feature (not just "students who happened to play a
// match"), that's the moment this gap has to be resolved for real —
// either add CLASS_ENROLLMENT back, or accept the limitation formally.

const express = require("express");
const { query } = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Generates a random 6-character uppercase alphanumeric code, e.g. "K3F9XQ".
// Excludes visually confusable characters (0/O, 1/I/L) to reduce students
// mistyping a code when a classmate reads it out loud.
function generateJoinCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * POST /api/classes
 * Instructor-only. Creates a new class with a unique join code.
 * Body: { class_name }
 */
router.post(
  "/",
  requireAuth,
  requireRole("instructor"),
  async (req, res, next) => {
    try {
      const { class_name } = req.body;

      if (!class_name || !class_name.trim()) {
        return res.status(400).json({ error: "class_name is required." });
      }

      // join_code has a UNIQUE constraint in the schema, so collisions are
      // rejected by Postgres — but with a 6-char code space that large,
      // a collision is extremely unlikely anyway. We still retry a few
      // times defensively instead of failing the whole request on the
      // rare chance of a clash.
      let joinCode;
      let inserted = null;
      const MAX_ATTEMPTS = 5;

      for (let attempt = 0; attempt < MAX_ATTEMPTS && !inserted; attempt++) {
        joinCode = generateJoinCode();
        try {
          const result = await query(
            `INSERT INTO "Class" (instructor_id, class_name, join_code)
           VALUES ($1, $2, $3)
           RETURNING class_id, class_name, join_code, created_at`,
            [req.user.id, class_name.trim(), joinCode],
          );
          inserted = result.rows[0];
        } catch (err) {
          // 23505 = Postgres unique_violation. Only retry for THAT specific
          // error — anything else (bad connection, etc.) should fail loudly
          // instead of silently looping.
          if (err.code !== "23505") throw err;
        }
      }

      if (!inserted) {
        return res
          .status(500)
          .json({
            error: "Could not generate a unique join code. Please try again.",
          });
      }

      res.status(201).json({ message: "Class created.", class: inserted });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/classes
 * Instructor-only. Lists classes owned by the logged-in instructor.
 */
router.get(
  "/",
  requireAuth,
  requireRole("instructor"),
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT class_id, class_name, join_code, created_at
       FROM "Class"
       WHERE instructor_id = $1
       ORDER BY created_at DESC`,
        [req.user.id],
      );

      res.json({ classes: result.rows });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/classes/join
 * Student-only. Looks up a class by join code.
 *
 * This is the route with the previously-known bug: a missing/invalid
 * code used to fall through to an unhandled DB error (raw 500). Fixed
 * here by explicitly checking whether a matching class was found BEFORE
 * doing anything else, and returning a clean 404 if not.
 *
 * Body: { join_code }
 */
router.post(
  "/join",
  requireAuth,
  requireRole("student"),
  async (req, res, next) => {
    try {
      const { join_code } = req.body;

      if (!join_code || !join_code.trim()) {
        return res.status(400).json({ error: "join_code is required." });
      }

      const result = await query(
        `SELECT class_id, class_name, join_code, instructor_id
       FROM "Class"
       WHERE join_code = $1`,
        [join_code.trim().toUpperCase()],
      );

      // ---- THE FIX ----
      // Explicitly check for "not found" and return 404 here, instead of
      // letting the code continue and hit a null-reference or a foreign-key
      // error further down (which is what was producing the raw 500 before).
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Invalid join code." });
      }

      const classRow = result.rows[0];

      // As noted at the top of this file: we can only confirm the class
      // exists and hand its info back to the student. There's no
      // CLASS_ENROLLMENT table to insert a membership record into. The
      // frontend should treat this as "you're now viewing this class" and
      // proceed to match-joining, not as durable enrollment.
      res.json({
        message:
          "Class found. Note: membership is not persisted separately — join a match under this class to participate.",
        class: classRow,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/classes/:id
 * Fetch one class's details. Restricted to the instructor who owns it,
 * for now — students only see class info via the /join response above.
 */
router.get(
  "/:id",
  requireAuth,
  requireRole("instructor"),
  async (req, res, next) => {
    try {
      const classId = parseInt(req.params.id, 10);

      if (Number.isNaN(classId)) {
        return res.status(400).json({ error: "Invalid class id." });
      }

      const result = await query(
        `SELECT class_id, instructor_id, class_name, join_code, created_at
       FROM "Class"
       WHERE class_id = $1`,
        [classId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Class not found." });
      }

      const classRow = result.rows[0];

      if (classRow.instructor_id !== req.user.id) {
        return res.status(403).json({ error: "You do not own this class." });
      }

      res.json({ class: classRow });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
