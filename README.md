# Dreamr

Generate and explore immersive 3D worlds from text prompts and images. Dreamr turns natural-language descriptions into explorable 360° environments — panoramas, videos, depth maps, and Gaussian splat worlds — viewable in a browser or VR headset.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Clerk |
| Database / Storage | Supabase (Postgres + Storage) |
| Background Jobs | Inngest |
| 3D Rendering | React Three Fiber, Three.js, Spark (Gaussian splats) |
| Styling | Tailwind CSS 4, CSS variables, Framer Motion |
| State | Zustand, TanStack React Query |
| AI Providers | fal.ai, World Labs |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (local or hosted)
- Clerk application
- Inngest dev server (for background jobs)

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI Providers
FAL_KEY=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

### Local Development

```bash
# Install dependencies
npm install

# Run database migrations
npx supabase db push

# Start the dev server
npm run dev

# In a separate terminal, start Inngest
npx inngest-cli dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
src/
├── app/                   # Next.js App Router pages + API routes
│   ├── api/
│   │   ├── scenes/        # Scene CRUD, generation, asset management
│   │   └── webhooks/      # Clerk + provider webhooks
│   ├── share/             # Public shared scene pages
│   └── (app)/             # Authenticated app routes
├── components/
│   ├── scene/             # Scene editor, prompt bar, controls
│   └── viewer/            # 3D canvas, equirect, video, splat renderers
├── lib/
│   ├── stores/            # Zustand stores (scene, viewer, pipeline)
│   ├── supabase/          # DB client helpers + types
│   ├── inngest/           # Background job definitions
│   ├── types/             # Shared TypeScript types
│   └── utils/             # Helpers (cn, rate-limit)
├── styles/                # Global CSS + CSS variables
└── middleware.ts           # Clerk auth middleware
```

### Generation Pipeline

Each scene progresses through a multi-step pipeline:

1. **Image 360** — Generate a 360° panorama from a text prompt (fal.ai)
2. **Video** — Animate the panorama into a 360° video
3. **Upscale** — Enhance video quality
4. **Depth** — Generate a depth map from the video
5. **World** — Build a Gaussian splat 3D world (World Labs / Marble)

Pipeline steps are orchestrated via Inngest and tracked in the `pipeline_jobs` table. Assets produced at each step are stored in Supabase Storage with references in the `assets` table.

### Sharing

Scenes can be shared via public links:
- `POST /api/scenes/:id/share` generates a unique share token
- `/share/:token` renders a read-only viewer (no auth required)
- `/share/:token/embed` provides an iframe-embeddable version
- OG images are auto-generated for social media previews

### Database

Supabase Postgres with the following core tables:
- `users` — Synced from Clerk
- `spaces` — Top-level project containers
- `scenes` — Individual world-building sessions
- `scene_inputs` — User-provided images with sphere positions
- `pipeline_jobs` — Tracks each generation step
- `assets` — All generated files (images, videos, splats)
- `scene_worlds` — Gaussian splat world references
- `generation_logs` — Cost and usage tracking

Migrations live in `supabase/migrations/`.

## Development

```bash
# Type check
npx tsc --noEmit

# Lint
npx next lint

# Build
npm run build
```

## Deployment

Dreamr is designed for deployment on Vercel:

1. Connect the GitHub repository to Vercel
2. Set all environment variables in the Vercel dashboard
3. Enable Inngest integration (or set the Inngest URL to your self-hosted instance)
4. Run `npx supabase db push` against your production Supabase instance

CI runs on every PR via GitHub Actions (type-check, lint, test).

## API Overview

All API routes are under `/api/` and require Clerk authentication unless noted.

| Method | Path | Description |
|---|---|---|
| GET | `/api/scenes/:id` | Fetch scene with inputs, jobs, assets |
| PATCH | `/api/scenes/:id` | Update scene metadata |
| DELETE | `/api/scenes/:id` | Delete a scene |
| POST | `/api/scenes/:id/generate` | Trigger pipeline generation |
| POST | `/api/scenes/:id/generate-world` | Trigger world generation |
| POST | `/api/scenes/:id/share` | Generate a share link |
| DELETE | `/api/scenes/:id/share` | Revoke a share link |
| GET | `/share/:token` | Public scene viewer (no auth) |
| GET | `/share/:token/embed` | Embeddable viewer (no auth) |

## Contributing

1. Create a feature branch from `main`
2. Make changes with passing type-check and lint
3. Open a PR — CI will run automatically
4. Get review and merge

## License

Private — all rights reserved.
