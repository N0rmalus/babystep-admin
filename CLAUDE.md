# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Babystep Admin

Multi-tenant e-commerce admin panel + REST API for the Babystep store. The storefront lives in `../babystep-store` and consumes this API.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, Prisma 5 + Neon Postgres, Clerk auth, Stripe, Cloudinary, Sentry.

## Commands

- `npm run dev` / `build` / `lint`
- `npm run typescript`: type check. Run it before saying a task is done.
- `npx prisma generate` (also runs on postinstall)

There is no test suite. CI runs `prisma generate`, `lint` and `build` on every push/PR.
Prettier: single quotes, 120 cols, trailing commas, tailwind plugin (`.prettierrc`).

## Rules

- API routes are used by the storefront: never change a response shape without telling me and listing what in babystep-store must change.
- Database: only the Neon `dev` branch. Never run `prisma migrate reset`, `db push --force-reset`, or anything that drops data. Ask before any migration.
- Never read or print `.env` values. Stripe: test mode only.
- Prefer existing shadcn components in `components/ui` over new ones.
- All user-facing strings (UI copy, toasts, API error responses) are in Lithuanian.

## Architecture

**Routing (`app/`)**
- `(auth)`: Clerk sign-in/sign-up. `(root)`: store setup; redirects to the user's first store if one exists.
- `(dashboard)/[storeId]`: admin pages. The layout checks store ownership via `getStoreByUserId`. Each resource follows the same pattern:
  - **List:** `page.tsx` (server, fetches via `queries/`) → `components/client.tsx` + `columns.tsx` + `cell-action.tsx` (TanStack table).
  - **Edit:** `[id]/page.tsx` → `[id]/components/<x>-form.tsx` + `schema.ts` (zod + react-hook-form).
  - Forms submit with axios to `/api/...`, then `router.refresh()` + `router.push()`. Errors go through `getFormErrorMessage`.

**Auth**: `proxy.ts` (Next 16's replacement for `middleware.ts`) protects everything except `/api(.*)` and sign-in/up. Ownership: `Store.userId` links each store to its Clerk user. API routes are public at the proxy level, so every *mutating* handler must call `auth()` and check `getStoreByUserId(storeId, userId)` (401 if no user, 403 if not the owner). Public GETs and `OPTIONS` return `corsHeaders` from `lib/cors.ts`.

**API**: `app/api/[storeId]/<resource>` serves both the admin (mutations) and the storefront (public GETs).
- `checkout` creates an unpaid `Order` + Stripe Checkout session.
- `api/webhook` handles `checkout.session.completed`: in a single transaction it marks the order paid, decrements stock and archives products that hit zero stock.
- Handlers return plain-text `NextResponse` errors and log with `console.log('[RESOURCE_METHOD]', error)`. Checkout returns JSON `{ message }` instead.

**Data**: `prisma/schema.prisma`.
- Top-level models carry `storeId`. `Subcategory`, `Image` and `OrderItem` are scoped through their parent.
- `relationMode = "prisma"` means no DB-level foreign keys, so every relation field needs an explicit `@@index`.
- All reads go through `queries/` (`server-only`) using the shared client in `lib/prismadb.ts`. Query functions use options objects plus TS overloads for typed payloads (see `queries/get-products.ts`). Extend those rather than calling Prisma ad hoc.

**Pricing**: `lib/product-pricing.ts` is the single source of truth for sale logic (`salePrice` + optional `saleStartsAt`/`saleEndsAt`).
- Use `getProductPricing` / `getProductEffectivePrice`, never `price` directly.
- `OrderItem.unitPrice` snapshots the price at checkout. `getOrderItemPrice` falls back to the current price for legacy rows.

**Rich text**: product descriptions are HTML from TipTap (`components/ui/tiptap-editor.tsx`). `lib/rich-text.ts` converts legacy plain text to HTML.

Route `params` are Promises: `const params = await props.params;`. Import alias `@/` = repo root.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on N0rmalus/babystep-admin (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
