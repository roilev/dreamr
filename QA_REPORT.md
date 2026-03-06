# Dreamr QA Report

**Branch**: `feat/slices-16-24`
**Date**: March 6, 2026
**Scope**: Full codebase audit (static analysis of all 95+ source files) + runtime UI testing with authenticated session

---

## Methodology

- **Static analysis**: Line-by-line review of all API routes, Inngest functions, Supabase migrations, React hooks, components, stores, and utility libraries
- **Runtime testing**: Authenticated browser testing of all UI flows (spaces, scenes, editor tabs, debug panel, breadcrumbs, inline editing, responsive layout)
- **API testing**: Direct Supabase and webhook endpoint testing via curl
- **Database verification**: Schema inspection against running Supabase instance

---

## Critical Issues

### 1. Webhook Forgery — Unauthenticated User Creation

**File**: `src/app/api/webhooks/clerk/route.ts` line 11
**Status**: Runtime-confirmed

When `CLERK_WEBHOOK_SECRET` is unset or empty, the webhook endpoint accepts any POST body without signature verification. An unauthenticated attacker can forge `user.created` or `user.updated` events to insert or overwrite arbitrary user records in the database.

**Reproduction**: Send a POST to `/api/webhooks/clerk` with a forged payload:
```json
{
  "type": "user.created",
  "data": {
    "id": "clerk_FORGED",
    "email_addresses": [{"email_address": "attacker@evil.com"}],
    "first_name": "Forged",
    "last_name": "User"
  }
}
```
Result: User row created in the `users` table. Verified and cleaned up during testing.

**Fix**: Always require and validate `CLERK_WEBHOOK_SECRET`. Remove the fallback `else { body = JSON.parse(rawBody) }` branch entirely.

---

### 2. Share API Uses Wrong Table/Column Names

**File**: `src/app/api/scenes/[sceneId]/share/route.ts` lines 15–27
**Status**: Will crash at runtime

The `ensureSceneOwnership` function in the share route queries `.from("spaces")` and `.select("id, space_id")`. The database table is still called `projects` with column `project_id` (migration 004 has not been applied). Every call to `POST /api/scenes/:id/share` or `DELETE /api/scenes/:id/share` will return 500.

**Note**: The history route (`history/route.ts`) and asset delete route (`assets/[assetId]/route.ts`) correctly use the old names (`projects`, `project_id`), making this an inconsistency within the same branch.

**Fix**: Change `from("spaces")` to `from("projects")` and `space_id` to `project_id` in the share route, or apply migration 004 and update all routes consistently.

---

### 3. `share_token` Column Does Not Exist

**File**: `supabase/migrations/006_share_tokens.sql`
**Status**: Runtime-confirmed (column missing)

Migration 006 adds `share_token` to the `scenes` table but has not been applied to the database. The share route attempts to `SELECT share_token` which fails with "column scenes.share_token does not exist". The entire sharing system (share links, embed pages, OpenGraph images) is non-functional.

**Fix**: Apply migration 006 to the Supabase instance.

---

## High Severity Issues

### 4. Admin Dashboard Has No Admin Authorization

**File**: `src/app/api/admin/usage/route.ts`
**Status**: Runtime-confirmed

The `/api/admin/usage` endpoint checks only `await auth()` (is the user logged in) but never verifies admin privileges. Any authenticated user can view all pipeline jobs, generation costs, model usage, and error logs across all users. Confirmed by viewing the admin dashboard showing $16.57 spend across 41 generations.

**Fix**: Add role-based access control. Check for an admin role/claim in the Clerk session before returning data.

---

### 5. IDOR on Scene Input Deletion

**File**: `src/app/api/scenes/[sceneId]/inputs/[inputId]/route.ts`
**Status**: Static analysis confirmed

The DELETE handler calls `ensureUser(clerkId)` but discards the return value. The `sceneId` parameter is available but never used for ownership verification. The delete operates solely on `inputId` using the admin Supabase client (which bypasses RLS). Any authenticated user can delete any other user's scene input by knowing or guessing the UUID.

**Fix**: Add ownership verification using `ensureSceneOwnership(supabase, sceneId, user.id)` before deleting, similar to other scene routes.

---

## Medium Severity Issues

### 6. Upload Route Accepts Arbitrary Bucket Names

**File**: `src/app/api/upload/route.ts` line 18
**Status**: Static analysis

The `body.bucket` value from the client is used directly in `supabase.storage.from(body.bucket)`. While the TypeScript type restricts it to `"scene-inputs" | "generated-assets"`, types are erased at runtime. An attacker can request a signed upload URL for any Supabase storage bucket.

**Fix**: Validate `body.bucket` against an allowlist at runtime:
```typescript
const ALLOWED_BUCKETS = ["scene-inputs", "generated-assets"];
if (!ALLOWED_BUCKETS.includes(body.bucket)) {
  return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
}
```

---

### 7. PATCH Routes Allow Arbitrary Field Updates

**Files**: `src/app/api/spaces/[spaceId]/route.ts` line 41, `src/app/api/scenes/[sceneId]/route.ts` line 64
**Status**: Static analysis

Both PATCH handlers spread the full request body into the Supabase update: `{ ...body, updated_at: ... }`. An attacker can include arbitrary fields like `user_id`, `status`, `id`, or `created_at` to manipulate records beyond the intended `name`/`description`/`prompt` fields.

**Fix**: Whitelist allowed fields explicitly:
```typescript
const { name, description } = body;
const updates = { ...(name && { name }), ...(description && { description }), updated_at: new Date().toISOString() };
```

---

### 8. Generation Tracker Uses Wrong Field Name

**File**: `src/hooks/use-generation-tracker.ts` line 106
**Status**: Runtime-confirmed

The tracker filters jobs by `j.step_name === step`, but `PipelineJobRow` uses the field `step` (not `step_name`). The filter never matches any jobs, so:
- Job failure detection via job status never works
- Only asset count changes or the 10-minute hard timeout surface completion/failure to the user
- Failed generations silently hang in the UI until timeout

**Fix**: Change `j.step_name` to `j.step` on line 106.

---

### 9. `NEXT_PUBLIC_APP_URL` Not Configured

**File**: `src/app/api/scenes/[sceneId]/share/route.ts` line 65
**Status**: Static analysis

Share URLs are constructed as `` `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}` ``. This env var is not in the `.env.example`, `.env.local` template, or documentation. Generated share URLs will be `undefined/share/abc123`.

**Fix**: Add `NEXT_PUBLIC_APP_URL` to the environment configuration and documentation.

---

### 10. Shared Scene Viewer Maps Splat Assets to Equirect Mode

**File**: `src/app/share/[shareId]/_components/shared-scene-viewer.tsx` lines 32–36
**Status**: Static analysis

The `bestAsset()` function returns splat assets (`splat_full`, `splat_500k`, `splat_100k`) with `mode: "equirect"`. When rendered, the splat URL would be passed to `<EquirectView>` which expects an image URL, not a 3D splat file. Shared 3D worlds will display incorrectly or fail to render.

**Fix**: Return `mode: "splat"` for splat assets and add a `<SplatWorld>` render path in the `ViewerScene` component.

---

## Low Severity Issues

### 11. Keyboard Shortcuts Registered as No-Ops

**File**: `src/components/ui/keyboard-shortcuts.tsx` lines 169–194
**Status**: Static analysis

`useDreamrShortcuts` registers `Mod+N`, `Mod+K`, `Mod+B` with empty `action: () => {}`. These shortcuts call `e.preventDefault()`, which overrides browser defaults (new window, address bar, bookmarks) but performs no application action.

**Fix**: Either implement the actions or don't register the shortcuts.

---

### 12. Rate Limiter Ineffective on Serverless

**File**: `src/lib/utils/rate-limit.ts`
**Status**: Static analysis

Uses an in-memory `Map` for rate limiting. On Vercel (serverless), each invocation gets a fresh runtime — the store is never shared across requests. Rate limiting is effectively non-functional in production.

**Fix**: Use Redis, Upstash, or Vercel KV for the rate limit store if actual enforcement is needed.

---

### 13. Gyroscope Button Uses Wrong CSS Variables

**File**: `src/components/viewer/controls/mobile-controls.tsx` lines 137–140
**Status**: Static analysis

Uses `bg-[hsl(var(--primary))]` and `text-[hsl(var(--primary-foreground))]` (shadcn/ui convention) instead of the project's CSS variables like `var(--accent-primary)`. The button will have no visible background color on mobile since `--primary` is not defined in `globals.css`.

**Fix**: Replace with the project's CSS variable convention: `bg-[var(--accent-primary)]`.

---

### 14. Migration 004/005 Latent Schema Mismatch

**Files**: `supabase/migrations/004_rename_projects_to_spaces.sql`, `005_generation_logs.sql`
**Status**: Runtime-confirmed (migrations not applied)

Migration 004 renames `projects` → `spaces` and `project_id` → `space_id`. Migration 005 creates `generation_logs` with `REFERENCES public.projects(id)`. All API routes query `from("projects")` with `project_id`.

Currently working because migrations 004/005 haven't been applied. However:
- Applying migration 004 without updating all API routes will break the entire app
- Migration 005 will fail after 004 because `projects` no longer exists
- The TypeScript `Database` type already uses `spaces`/`space_id`, but all queries bypass type checking with `as never` casts
- The `generation_logs` table does not exist

**Fix**: Either apply the migrations and update all code, or remove the migrations and update the types. The current split state is a ticking time bomb.

---

### 15. ESLint Configuration Broken

**File**: `eslint.config.mjs`
**Status**: Runtime-confirmed

`npm run lint` fails with `TypeError: Converting circular structure to JSON`. The `FlatCompat` wrapper causes a circular reference with `eslint-config-next@16.1.6`, which already exports native flat configs.

**Fix**: Replace `compat.extends("next/core-web-vitals", "next/typescript")` with direct imports from `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

---

## Design Observations (Non-Bugs)

### All API Routes Use Admin Supabase Client

Every API route creates `createAdminSupabase()` (service role key, bypasses RLS) instead of `createServerSupabase()` (anon key, respects RLS). The RLS policies defined in migration 002 exist but are never exercised by the application. The app relies entirely on application-level ownership checks.

This is a deliberate design choice but means RLS provides no defense-in-depth. A single missing ownership check (like issue #5) becomes a direct data access vulnerability.

### Duplicated `ensureSceneOwnership` Helper

The `ensureSceneOwnership` function is copy-pasted in 6 different route files with identical logic. Should be extracted to a shared module.

---

## UI Testing Results

All UI features tested via authenticated browser session. No bugs found:

| Feature | Status | Notes |
|---|---|---|
| Tab switching (all 6 tabs) | ✅ Pass | Smooth Framer Motion animations, no layout shifts |
| Prompt bar show/hide per tab | ✅ Pass | Correct visibility and placeholder text per mode |
| Tab indicator animation | ✅ Pass | `layoutId="tab-indicator"` works cleanly |
| Debug panel toggle | ✅ Pass | Opens with collapsible sections, all data renders |
| Breadcrumb navigation | ✅ Pass | Dreamr → Space → Scene routing works |
| Scene name inline editing | ✅ Pass | Click-to-edit, Enter to save, Escape to cancel |
| Responsive layout | ✅ Pass | Fullscreen and resize adapt correctly |
| Error overlays | ✅ Pass | No runtime errors visible |
| Space creation | ✅ Pass | Dialog, form submission, list refresh |
| Scene creation | ✅ Pass | Auto-navigates to editor |

---

## Summary

| Severity | Count | Key Items |
|---|---|---|
| Critical | 3 | Webhook forgery, share route wrong table names, share_token column missing |
| High | 2 | Admin dashboard no auth, IDOR on input deletion |
| Medium | 5 | Arbitrary bucket upload, arbitrary PATCH fields, generation tracker field name, missing APP_URL, shared viewer wrong mode |
| Low | 4 | No-op keyboard shortcuts, in-memory rate limiter, wrong CSS vars, ESLint broken |
| Design | 2 | Admin client bypasses RLS, duplicated helper function |
| UI/Animation | 0 | All clean |
