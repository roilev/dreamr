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

### Admin RBAC (Clerk publicMetadata)

Admin access uses Clerk's `publicMetadata.role` field — **not** env vars.

**Setup (one-time per admin user):**
1. Go to Clerk Dashboard → Users → select user → Metadata
2. Set **Public metadata** to: `{ "role": "admin" }`

**Optional performance optimization:**
1. Clerk Dashboard → Sessions → Edit session token
2. Add: `{ "metadata": "{{user.public_metadata}}" }`
   This avoids an extra Clerk API call on every server-side admin check.

**How it works:**
- **Server**: `isAdminServer()` in `src/lib/clerk/check-role.ts` checks `sessionClaims.metadata.role` (fast) then falls back to `currentUser().publicMetadata.role`.
- **Client**: `useIsAdmin()` hook reads `publicMetadata.role` via Clerk's `useUser()` + a persisted `adminMode` toggle from `useAppStore()`.
- **Toggle**: The `<CustomUserButton>` in the header shows "Switch to Admin/Standard View" for users with the admin role. Admin features (debug panel, all-spaces view, cross-user scene access) only activate when the toggle is on.

### Known issues

- **ESLint**: `npm run lint` fails with `TypeError: Converting circular structure to JSON`. Known compatibility issue between `eslint-config-next@16.1.6` using `FlatCompat` and `@eslint/eslintrc`. The package already exports native flat configs that would fix this.
- **Migration 004 not applied**: `supabase/migrations/004_rename_projects_to_spaces.sql` renames `projects` → `spaces` and `project_id` → `space_id`, but has not been applied to the live Supabase instance. All API routes still use `projects`/`project_id`. Applying this migration without updating the code will break all API routes.
- **Migration 005 depends on 004**: `generation_logs` table references `public.projects(id)` but migration 004 renames it to `spaces`. The `generation_logs` table does not exist in the current database.

### Follow-up tasks

- **Apply migrations 004 + 005 and update all code**: This is a coordinated refactor that must be done atomically. Steps: (1) Update migration 005 to reference `spaces` instead of `projects`. (2) Find-and-replace `from("projects")` → `from("spaces")` and `project_id` → `space_id` across all API routes, Inngest functions, and `src/lib/supabase/ensure-scene-ownership.ts`. (3) Remove `as never` casts from Supabase queries since the TypeScript `Database` type already uses `spaces`/`space_id`. (4) Apply migrations 004 and 005 to the live Supabase instance. (5) Test every API endpoint. Do NOT apply the migrations without the code changes — it will break all routes.

### Key conventions

- Middleware lives at `src/proxy.ts` (not the usual `src/middleware.ts`)
- See `.cursor/rules/dreamr.mdc` for coding conventions and file ownership rules
- No test framework is configured; test fixtures exist at `src/test/fixtures/` for future use
- Package manager is **npm** (lockfile is `package-lock.json`)
- The database table is still called `projects` (not `spaces`) and the FK column is `project_id` (not `space_id`), despite migration 004 and the TypeScript `Database` type using the new names. All Supabase queries bypass type checking via `as never` casts.
