# Dreamr

AI-powered immersive 3D world builder (Next.js 16 / React 19 / TypeScript).

## Cursor Cloud specific instructions

### Services

| Service | Port | Command |
|---|---|---|
| Next.js dev server | 3000 | `npm run dev` |
| Inngest dev server | 8288 | `npx inngest-cli@latest dev --no-discovery --port 8288` |

Both services must run for the full development flow. The Inngest dev server handles background pipeline functions (image/video/3D generation).

### Required environment variables

Create `.env.local` in the project root. All of these require real credentials from their respective services:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth (app won't render any page without valid keys)
- `CLERK_WEBHOOK_SECRET` — Svix webhook for Clerk-to-Supabase user sync
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase (DB, storage, realtime)
- `FAL_KEY` — fal.ai API (optional; needed only for AI generation)
- `MARBLE_API_KEY` / `MARBLE_API_URL` — World Labs Marble API (optional; only for 3D world generation)

### Known issues

- **ESLint**: `npm run lint` fails with `TypeError: Converting circular structure to JSON`. This is a known compatibility issue between `eslint-config-next@16.1.6` using `FlatCompat` and the `@eslint/eslintrc` config-validator. The `eslint-config-next` package already exports native flat configs (`eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`) which would fix this if the `eslint.config.mjs` were updated to use them directly instead of `FlatCompat`.

### Key conventions

- Middleware lives at `src/proxy.ts` (not the usual `src/middleware.ts`)
- See `.cursor/rules/dreamr.mdc` for coding conventions and file ownership rules
- No test framework is configured; test fixtures exist at `src/test/fixtures/` for future use
- Package manager is **npm** (lockfile is `package-lock.json`)
