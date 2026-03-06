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
- **Migrations 004-007 pending**: Code has been updated to use `spaces`/`space_id`/`short_id`. Migrations must be applied to the live Supabase instance in order: 004 (rename projects→spaces), 005 (generation_logs), 006 (share_tokens), 007 (short_ids). The app will not work until these are applied.

### Key conventions

- Middleware lives at `src/proxy.ts` (not the usual `src/middleware.ts`)
- See `.cursor/rules/dreamr.mdc` for coding conventions and file ownership rules
- No test framework is configured; test fixtures exist at `src/test/fixtures/` for future use
- Package manager is **npm** (lockfile is `package-lock.json`)
- URL structure: `/{spaceShortId}/scene/{sceneShortId}` (short 10-char nanoid-style IDs)
- ID utilities in `src/lib/ids.ts`: `generateShortId()`, `isUUID()`, `idColumn()`
- All API routes accept both UUID and `short_id` for space/scene lookups
- `ensureSceneOwnership()` returns the resolved UUID (string) or null, not a boolean
