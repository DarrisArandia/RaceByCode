-- Active: 1789353789892@@localhost@5432@Rby@public@public
--
-- Reconstructed from the ERD description in Chapter 3 (Figure 8) of the
-- capstone document, since the actual finalized race_by_code_schema.sql
-- file wasn't available in this session.
--
-- ⚠️ IMPORTANT: Compare this against your real, already-finalized
-- race_by_code_schema.sql before using it. If column names or types
-- differ, every route file we build after this needs to match YOUR real
-- schema, not this reconstruction. Treat this as a working draft to
-- reconcile, not a replacement.
--
-- 13 entities per the capstone doc's ERD description:
--   User, Class, LearningTrack, Topic, Question, Match, MatchParticipant,
--   StudentAnswer, Feedback, Progress, Achievement, UserAchievement, AtRiskFlag
--
-- Known deliberate gap (per your earlier note, still unresolved):
-- There is NO separate CLASS_ENROLLMENT table. This means a student's
-- membership in a class can only be inferred indirectly — e.g. through
-- MatchParticipant rows tied to a private Match that belongs to that
-- Class — not queried directly ("give me every student enrolled in
-- Class X" has no direct table to ask). This is flagged again below at
-- the Class table. Confirm with your adviser whether to formalize this
-- as an accepted deviation or add the table back.

-- ============================================================
-- USER
-- Stores BOTH students and instructors, distinguished by `role`.
-- ============================================================
CREATE TABLE "User" (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,       -- bcrypt hash, never plaintext
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'instructor')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLASS
-- Created and managed by an instructor.
-- ⚠️ No CLASS_ENROLLMENT junction table exists (see note above) — a
-- student "joins" a class conceptually via the join_code, but there is
-- currently nowhere to permanently record "Student X belongs to Class Y"
-- independent of match participation.
-- ============================================================
CREATE TABLE "Class" (
    class_id SERIAL PRIMARY KEY,
    instructor_id INTEGER NOT NULL REFERENCES "User"(user_id),
    class_name VARCHAR(100) NOT NULL,
    join_code VARCHAR(10) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEARNING_TRACK
-- The two tracks: C++ (fundamentals) and Java (OOP concepts).
-- ============================================================
CREATE TABLE "LearningTrack" (
    track_id SERIAL PRIMARY KEY,
    track_name VARCHAR(50) NOT NULL,   -- e.g. 'C++', 'Java'
    description TEXT
);

-- ============================================================
-- TOPIC
-- Syllabus-aligned subtopics within a track (e.g. "Loops" under C++,
-- "Inheritance" under Java).
-- ============================================================
CREATE TABLE "Topic" (
    topic_id SERIAL PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES "LearningTrack"(track_id),
    topic_name VARCHAR(100) NOT NULL,
    description TEXT
);

-- ============================================================
-- QUESTION
-- Instructor-authored question bank, tied to a topic and difficulty
-- level (used by adaptiveLogic.js to pick the next question).
-- ============================================================
CREATE TABLE "Question" (
    question_id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES "Topic"(topic_id),
    created_by INTEGER NOT NULL REFERENCES "User"(user_id), -- instructor who authored it
    question_text TEXT NOT NULL,
    expected_answer TEXT,              -- reference answer/requirements for AI evaluation
    difficulty_level VARCHAR(20) NOT NULL CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MATCH
-- A single race session — either Public (auto-matched, up to 4 players,
-- no class attached) or Private (instructor-hosted, tied to a Class).
-- ============================================================
CREATE TABLE "Match" (
    match_id SERIAL PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES "LearningTrack"(track_id),
    class_id INTEGER REFERENCES "Class"(class_id),   -- NULL for Public matches
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('public', 'private')),
    match_code VARCHAR(10) UNIQUE,                    -- used for private match join, NULL for public
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- ============================================================
-- MATCH_PARTICIPANT
-- Links a student to a match they're playing in. The 4-player cap
-- (Public Match) is enforced in application code (matchRoutes.js),
-- NOT here — Postgres alone can't easily enforce "max 4 rows per
-- match_id" without a trigger, which is more complexity than this
-- project needs right now.
-- ============================================================
CREATE TABLE "MatchParticipant" (
    participant_id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES "Match"(match_id),
    user_id INTEGER NOT NULL REFERENCES "User"(user_id),
    score INTEGER NOT NULL DEFAULT 0,
    car_position INTEGER NOT NULL DEFAULT 0,   -- how far the car has moved
    final_rank INTEGER,                        -- set when match ends
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, user_id)                 -- a student can't join the same match twice
);

-- ============================================================
-- STUDENT_ANSWER
-- Each answer a student submits during a match.
-- ============================================================
CREATE TABLE "StudentAnswer" (
    answer_id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL REFERENCES "MatchParticipant"(participant_id),
    question_id INTEGER NOT NULL REFERENCES "Question"(question_id),
    submitted_answer TEXT NOT NULL,
    is_correct BOOLEAN,                    -- filled in after AI evaluation
    time_taken_seconds INTEGER,
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FEEDBACK
-- The AI-generated evaluation result tied to one submitted answer.
-- ============================================================
CREATE TABLE "Feedback" (
    feedback_id SERIAL PRIMARY KEY,
    answer_id INTEGER NOT NULL REFERENCES "StudentAnswer"(answer_id),
    feedback_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROGRESS
-- Per-student, per-track running totals (rank tier lives here too).
-- ============================================================
CREATE TABLE "Progress" (
    progress_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "User"(user_id),
    track_id INTEGER NOT NULL REFERENCES "LearningTrack"(track_id),
    total_score INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    accuracy_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- percentage, e.g. 82.50
    tier VARCHAR(30) NOT NULL DEFAULT 'Bronze',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, track_id)
);

-- ============================================================
-- ACHIEVEMENT
-- Master list of possible achievements/badges.
-- ============================================================
CREATE TABLE "Achievement" (
    achievement_id SERIAL PRIMARY KEY,
    achievement_name VARCHAR(100) NOT NULL,
    description TEXT,
    criteria TEXT   -- human-readable rule, e.g. "Win 5 public matches"
);

-- ============================================================
-- USER_ACHIEVEMENT
-- Which achievements a specific student has actually earned.
-- ============================================================
CREATE TABLE "UserAchievement" (
    user_achievement_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "User"(user_id),
    achievement_id INTEGER NOT NULL REFERENCES "Achievement"(achievement_id),
    earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)   -- can't earn the same achievement twice
);

-- ============================================================
-- AT_RISK_FLAG
-- Instructor-facing flag when a student shows patterns of struggling
-- on a specific topic (repeated low scores, slow answers, frequent errors).
-- ============================================================
CREATE TABLE "AtRiskFlag" (
    flag_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "User"(user_id),
    topic_id INTEGER REFERENCES "Topic"(topic_id),   -- nullable: flag can be track-wide
    reason TEXT NOT NULL,
    flagged_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);

