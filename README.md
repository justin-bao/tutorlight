# Tutorlight

Tutorlight is an AI tutoring web app that turns any topic into a guided lesson with spoken narration, a dynamic whiteboard, saved lesson history, and contextual Q&A.

Learners enter a topic, sign in, and the app generates a multi-section lesson. Each section includes a tutor script, timed whiteboard events, optional sources, and an interactive Q&A panel that can reference selected whiteboard items.

## Features

- Topic-to-lesson generation through a Python FastAPI backend and an OpenAI-compatible chat completions API
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
- Python FastAPI backend
- OpenAI-compatible AI provider
- Radix UI primitives and shadcn-style components

## Getting Started

### Prerequisites

- Node.js 22 or newer
- Python 3.11 or newer
- npm or Bun
- A Supabase project
- An AI API key for an OpenAI-compatible chat completions provider

### Install dependencies

```bash
npm install
```

Or, if you prefer Bun:

```bash
bun install
```

### Configure environment variables

Create a local environment file and provide the Supabase, frontend API, and AI provider settings.

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
VITE_API_BASE_URL=""
AI_API_KEY="your-ai-api-key"
AI_BASE_URL="https://api.openai.com/v1"
AI_MODEL="gpt-4.1-mini"
FRONTEND_ORIGIN="http://localhost:3000"
```

The browser client uses the `VITE_` variables at build time. The Python backend reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, and `FRONTEND_ORIGIN`.

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

Install the Python backend dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Start the backend:

```bash
npm run dev:backend
```

In another terminal, start the frontend:

```bash
npm run dev
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8000` by default. Open the local URL printed by the frontend dev server.

## Scripts

```bash
npm run dev        # Start the Vite dev server
npm run dev:backend # Start the Python FastAPI backend
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

src/components/lesson/
  TutorOrb.tsx              Animated tutor presence
  useTutorSpeech.ts         Browser SpeechSynthesis integration

src/components/whiteboard/
  Whiteboard.tsx            Whiteboard canvas/layout
  WhiteboardElement.tsx     Event rendering and summaries
  useSectionTimeline.ts     Playback timeline state

src/integrations/
  supabase/                 Supabase clients and generated types

supabase/migrations/        Database schema and security policies

backend/
  main.py                   FastAPI app for lesson generation and Q&A
  requirements.txt          Python dependencies
```

## How Lesson Generation Works

1. A signed-in user submits a topic from the home page.
2. The app inserts a `lessons` row with `status = "generating"`.
3. The browser calls the Python `/api/generate-lesson` endpoint with the user's Supabase access token.
4. The backend verifies the token with Supabase, asks the configured AI provider for a structured lesson, validates it with Pydantic, and writes sections into `lesson_sections`.
5. The lesson view polls until the lesson is `ready`, then starts section playback.

## Deployment

The frontend builds with Vite/TanStack Start. The backend is a separate FastAPI service and should be deployed on a Python-capable host.

Before deploying, make sure production environment variables are available to the frontend and backend runtimes:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- `FRONTEND_ORIGIN`

Then build the app:

```bash
npm run build
```

## Notes

- The tutor voice uses the browser's built-in SpeechSynthesis API, so available voices vary by browser and operating system.
- The whiteboard timeline schema is shared between the AI endpoint, database JSON payloads, and renderer through `src/lib/whiteboard-types.ts`.
- Generated Supabase types live in `src/integrations/supabase/types.ts`.
