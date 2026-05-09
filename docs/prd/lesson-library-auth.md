# PRD — Lesson Library & Auth

## Problem

Lessons take time and compute to generate, and learners often want to revisit them. Without accounts, every visit is a cold start and there's nowhere to keep your history.

## Users & jobs

- **Returning learner:** "Open that lesson on diffusion models I started yesterday."
- **Reviewer:** "Browse everything I've learned this month."
- **Privacy-conscious user:** "My lessons should be mine — not public."

## Goals

- Email/password and Google OAuth sign-in.
- Per-user library of generated lessons with title, topic, and status.
- Strict row-level security on every table holding user content.
- Profile row auto-created on signup.

## Non-goals

- Sharing lessons publicly (today).
- Teams / orgs.
- Lesson folders or tagging.

## Experience

- `/auth` handles sign up, sign in, and OAuth.
- `/lessons` lists the user's lessons (newest first), with status badges.
- Clicking a lesson opens `/lesson/$lessonId` for replay.
- Sign-out returns to landing.

## Functional requirements

- Tables: `profiles`, `lessons`, `lesson_sections`, `lesson_messages`.
- RLS: every row scoped to `auth.uid() = user_id` (or via `has_lesson_access` helper for child rows).
- Trigger: on `auth.users` insert, create a `profiles` row.
- Storage `lesson-audio` bucket policies use the same access helper.
- Email confirmation required by default (no auto-confirm).

## Quality bar

- No table is readable across users (verified by RLS tests).
- OAuth flow returns user to the originally-requested route.
- Library page loads <500ms for typical user (≤200 lessons) — paginate beyond that.

## Dependencies

- Supabase Auth (email/password + Google OAuth).
- Supabase Postgres + Storage.

## Open questions

- Public share links with a per-lesson token?
- Soft-delete vs hard-delete?
- Export lesson as PDF / markdown bundle?
