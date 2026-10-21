-- database/seed.sql
--
-- Demo data so you can test login, class joining, question banks, and
-- matches without typing data by hand every time.
--
-- ALL demo accounts use the same plaintext password for convenience:
--   Password123!
-- The hash below was generated with bcrypt (10 salt rounds) via bcryptjs,
-- matching what authRoutes.js will use for real registration later.
--
-- Run this AFTER schema.sql has been applied to an empty database:
--   psql -U your_user -d race_by_code -f database/schema.sql
--   psql -U your_user -d race_by_code -f database/seed.sql

-- ============================================================
-- USERS — 1 instructor, 3 students
-- ============================================================
INSERT INTO "User" (username, email, password_hash, role) VALUES
('prof_reyes',   'reyes.instructor@plmun.edu.ph', '$2b$10$l/e2kYzX0oOfckMcmfvTr.GDQoCStfRTFdET/8caevdeXfrWfBToq', 'instructor'),
('student_juan', 'juan.student@plmun.edu.ph',     '$2b$10$l/e2kYzX0oOfckMcmfvTr.GDQoCStfRTFdET/8caevdeXfrWfBToq', 'student'),
('student_maria','maria.student@plmun.edu.ph',    '$2b$10$l/e2kYzX0oOfckMcmfvTr.GDQoCStfRTFdET/8caevdeXfrWfBToq', 'student'),
('student_carlo','carlo.student@plmun.edu.ph',    '$2b$10$l/e2kYzX0oOfckMcmfvTr.GDQoCStfRTFdET/8caevdeXfrWfBToq', 'student');

-- ============================================================
-- CLASS — owned by prof_reyes (user_id 1)
-- ============================================================
INSERT INTO "Class" (instructor_id, class_name, join_code) VALUES
(1, 'IT101 - Intro to Programming', 'IT101X');

-- ============================================================
-- LEARNING TRACKS
-- ============================================================
INSERT INTO "LearningTrack" (track_name, description) VALUES
('C++',  'Fundamental programming concepts: variables, data types, operators, conditionals, loops, arrays, functions.'),
('Java', 'Object-oriented programming concepts: classes, objects, methods, constructors, inheritance, encapsulation, polymorphism.');

-- ============================================================
-- TOPICS — a few per track
-- ============================================================
INSERT INTO "Topic" (track_id, topic_name, description) VALUES
(1, 'Variables and Data Types', 'Declaring variables, primitive types, type conversion.'),
(1, 'Conditional Statements',   'if/else, switch-case logic.'),
(1, 'Loops',                    'for, while, do-while loops.'),
(2, 'Classes and Objects',      'Defining classes, creating objects, constructors.'),
(2, 'Inheritance',              'Extending classes, method overriding.');

-- ============================================================
-- QUESTIONS — spread across topics and difficulty levels
-- ============================================================
INSERT INTO "Question" (topic_id, created_by, question_text, expected_answer, difficulty_level) VALUES
(1, 1, 'Declare an integer variable named "score" and set it to 0.', 'int score = 0;', 'easy'),
(1, 1, 'What data type would you use to store a single character in C++?', 'char', 'easy'),
(2, 1, 'Write an if-statement that prints "Pass" if score is 75 or higher.', 'if (score >= 75) { cout << "Pass"; }', 'medium'),
(3, 1, 'Write a for-loop that prints numbers 1 to 5.', 'for (int i = 1; i <= 5; i++) { cout << i; }', 'medium'),
(3, 1, 'Write a while-loop that counts down from 5 to 1.', 'int i = 5; while (i >= 1) { cout << i; i--; }', 'hard'),
(4, 1, 'Define a Java class named "Car" with a private field "speed".', 'class Car { private int speed; }', 'easy'),
(4, 1, 'Write a constructor for the Car class that sets speed to 0.', 'public Car() { speed = 0; }', 'medium'),
(5, 1, 'Write a Java class "SportsCar" that extends "Car".', 'class SportsCar extends Car { }', 'medium'),
(5, 1, 'Override the toString() method in SportsCar to return "Sports Car".', '@Override public String toString() { return "Sports Car"; }', 'hard');

-- ============================================================
-- ACHIEVEMENTS — master list (none earned yet, so no UserAchievement rows)
-- ============================================================
INSERT INTO "Achievement" (achievement_name, description, criteria) VALUES
('First Race',      'Complete your first match.',              'matches_played >= 1'),
('Perfect Round',    'Answer every question correctly in one match.', 'all answers in a match are correct'),
('5 Wins',           'Finish first place in 5 matches.',        'final_rank = 1 in 5 matches');

-- Note: MatchParticipant, StudentAnswer, Feedback, Progress, UserAchievement,
-- and AtRiskFlag are intentionally left empty here — those get populated by
-- actually playing a match through the real app, not by seed data. Seeding
-- fake match history would make it harder to tell real bugs from fake data
-- once matchRoutes.js and the socket layer are built.