# Tutorlight

Tutorlight is an AI tutoring web app that turns any topic into a guided lesson with spoken narration, a dynamic whiteboard, saved lesson history, and contextual Q&A.

Learners enter a topic, sign in, and the app generates a multi-section lesson. Each section includes a tutor script, timed whiteboard events, optional sources, and an interactive Q&A panel that can reference selected whiteboard items.

## Features

- Topic-to-lesson generation through the Lovable AI gateway
- Supabase authentication with email/password and Google OAuth
- Saved lesson library per user
- Dynamic whiteboard renderer for titles, bullets, definitions, equations, diagrams, images, code, annotations, and clear events
- Browser SpeechSynthesis narration with play/pause controls
- Timed section playback that reveals whiteboard elements as the tutor speaks
- Contextual Q&A that uses the current section, visible whiteboard state, and selected whiteboard elements
- Row-level security for profiles, lessons, lesson sections, and lesson messages

## Tech Stack

- React 19
- TanStack Start and TanStack Router
- Vite
- TypeScript
- Tailwind CSS 4
- Supabase
- Lovable Cloud Auth and Lovable AI gateway
- Cloudflare Workers via Wrangler
- Radix UI primitives and shadcn-style components

## Getting Started

### Prerequisites

- Node.js 22 or newer
- npm or Bun
- A Supabase project
- A Lovable API key for lesson generation and Q&A

### Install dependencies

```bash
npm install
```

Or, if you prefer Bun:

```bash
bun install
```

### Configure environment variables

Create a local environment file and provide the Supabase and Lovable settings used by both the browser client and server routes.

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
LOVABLE_API_KEY="your-lovable-api-key"
```

The client prefers the `VITE_` variables at build time. The server routes read `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `LOVABLE_API_KEY`.

### Set up the database

Apply the migrations in `supabase/migrations` to your Supabase project. They create:

- `profiles`
- `lessons`
- `lesson_sections`
- `lesson_messages`
- RLS policies that restrict rows to the signed-in user
- A trigger that creates a profile when a user signs up

The Supabase project id in `supabase/config.toml` is currently:

```text
vavyxidgklvrehkheckl
```

### Run locally

```bash
npm run dev
```

The app starts with Vite. Open the local URL printed by the dev server.

## Scripts

```bash
npm run dev        # Start the Vite dev server
npm run build      # Build for production
npm run build:dev  # Build in development mode
npm run preview    # Preview the production build
npm run lint       # Run ESLint
npm run format     # Format the repo with Prettier
```

## Project Structure

```text
src/routes/
  index.tsx                 Landing page and topic prompt
  auth.tsx                  Sign up, sign in, and OAuth flow
  lessons.tsx               Saved lesson list
  lesson.$lessonId.tsx      Live lesson view
  api/generate-lesson.ts    Authenticated AI lesson generation endpoint
  api/lesson-qa.ts          Authenticated contextual tutor Q&A endpoint

src/components/lesson/
  TutorOrb.tsx              Animated tutor presence
  useTutorSpeech.ts         Browser SpeechSynthesis integration

src/components/whiteboard/
  Whiteboard.tsx            Whiteboard canvas/layout
  WhiteboardElement.tsx     Event rendering and summaries
  useSectionTimeline.ts     Playback timeline state

src/integrations/
  supabase/                 Supabase clients and generated types
  lovable/                  Lovable OAuth helper

supabase/migrations/        Database schema and security policies
```

## How Lesson Generation Works

1. A signed-in user submits a topic from the home page.
2. The app inserts a `lessons` row with `status = "generating"`.
3. The browser calls `/api/generate-lesson` with the user's Supabase access token.
4. The server route verifies the token, asks the Lovable AI gateway for a structured lesson, validates it with Zod, and writes sections into `lesson_sections`.
5. The lesson view polls until the lesson is `ready`, then starts section playback.

## Deployment

This project is configured for Cloudflare Workers through `wrangler.jsonc` and `@cloudflare/vite-plugin`.

Before deploying, make sure production environment variables are available to the worker runtime:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY`

Then build the app:

```bash
npm run build
```

## Notes

- The tutor voice uses the browser's built-in SpeechSynthesis API, so available voices vary by browser and operating system.
- The whiteboard timeline schema is shared between the AI endpoint, database JSON payloads, and renderer through `src/lib/whiteboard-types.ts`.
- Generated Supabase types live in `src/integrations/supabase/types.ts`.
