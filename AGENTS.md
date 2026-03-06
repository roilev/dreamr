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

### Clerk sign-in for testing

Clerk email verification blocks automated logins from new devices. Use the Clerk Backend API to create a sign-in token:
```bash
CLERK_USER_ID=$(curl -s -H "Authorization: Bearer $CLERK_SECRET_KEY" "https://api.clerk.com/v1/users?email_address=$TEST_LOGIN_EMAIL" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
SIGN_IN_URL=$(curl -s -X POST -H "Authorization: Bearer $CLERK_SECRET_KEY" -H "Content-Type: application/json" "https://api.clerk.com/v1/sign_in_tokens" -d "{\"user_id\": \"$CLERK_USER_ID\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['url'])")
```
Then navigate to `$SIGN_IN_URL` in the browser to authenticate without email verification.

### Known issues

- **ESLint**: `npm run lint` fails with `TypeError: Converting circular structure to JSON`. Known compatibility issue between `eslint-config-next@16.1.6` using `FlatCompat` and `@eslint/eslintrc`. The package already exports native flat configs that would fix this.
- **Migration 004 not applied**: `supabase/migrations/004_rename_projects_to_spaces.sql` renames `projects` → `spaces` and `project_id` → `space_id`, but has not been applied to the live Supabase instance. All API routes still use `projects`/`project_id`. Applying this migration without updating the code will break all API routes.
- **Migration 005 depends on 004**: `generation_logs` table references `public.projects(id)` but migration 004 renames it to `spaces`. The `generation_logs` table does not exist in the current database.

### Key conventions

- Middleware lives at `src/proxy.ts` (not the usual `src/middleware.ts`)
- See `.cursor/rules/dreamr.mdc` for coding conventions and file ownership rules
- No test framework is configured; test fixtures exist at `src/test/fixtures/` for future use
- Package manager is **npm** (lockfile is `package-lock.json`)
- The database table is still called `projects` (not `spaces`) and the FK column is `project_id` (not `space_id`), despite migration 004 and the TypeScript `Database` type using the new names. All Supabase queries bypass type checking via `as never` casts.
