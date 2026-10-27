# TODO

Findings from the 2026-10-24 audit, ranked by impact on a shop taking real orders.

Payments are moving from Stripe to Montonio. Don't spend time on Stripe-only fixes; the items below are written so they carry over.

## Montonio migration

High-level plan. How Montonio works is not researched yet: read their docs first and fill in the details from there.

- [ ] **Research Montonio.** How orders are created and paid, how payment results reach us, which payment states exist, what customer data comes back, and whether it offers anything for shipping.
- [ ] **Replace payment creation in checkout.** `app/api/[storeId]/checkout/route.ts:130` creates the Stripe session. Keep the contract the storefront uses (`{ productIds }` in, `{ url }` out) so the store needs no change at switch-over, and link the payment to our `order.id`.
- [ ] **Replace the payment webhook.** `app/api/webhook/route.ts`. Keep the existing transaction (mark paid once, decrement stock, archive sold-out products). Mark an order paid only once the payment is confirmed, and verify that the notification really comes from the provider.
- [ ] **Charge shipping.** Today nothing is charged: the Stripe session has no shipping line, while the storefront shows 4,99 € and the delivery page promises 3,49 € (parcel locker) and 6,49 € (courier). Decide the delivery options and prices, then have checkout accept a delivery method, compute the price server-side, apply the free-shipping threshold and store it on the order.
- [ ] **Keep collecting address and phone.** Stripe's hosted page collects them today (`billing_address_collection`, `phone_number_collection`) and the webhook copies them onto the order. Make sure orders still get them after the switch.
- [ ] **Return customers to the storefront with our order ID** so the store can show a real confirmation (see the storefront TODO).
- [ ] **Remove Stripe.** `lib/stripe.ts`, the `STRIPE_*` env vars and the `stripe` dependency.
- [ ] **Update `CLAUDE.md` for Montonio.** It mentions Stripe in the stack list, the "Stripe: test mode only" rule and the `checkout` description. Replace them with Montonio, keeping a test-only rule for whatever test environment Montonio provides.

## High

- [ ] **Overselling charges customers without a paid order.** Checkout checks stock but doesn't reserve it; if two people pay for the last item, the second webhook fails with 500 and the order stays unpaid while the customer has paid. Fix it independently of the provider: reserve stock when the order is created in checkout, and release it when the order is cancelled or expires. `app/api/[storeId]/checkout/route.ts:76`, `app/api/webhook/route.ts:104`
- [ ] **Product PATCH can wipe all images.** Images are deleted and re-added in two separate steps; if the second fails the product has none. Do it in one transaction. `app/api/[storeId]/products/[productId]/route.ts:131-163`
- [ ] **Sale dates drift by the timezone offset on every save.** The form sends dates without a timezone and the server (UTC in prod) reads them as UTC, which can change the charged price. `product-form.tsx:65`, `product-form.tsx:113`

## Medium

- [ ] Orders table: "Apmokėta" column is always blank, no date column, abandoned unpaid orders mixed with real ones. `orders/components/columns.tsx:179`
- [ ] Unpaid orders are never cleaned up. Once stock is reserved, the cleanup job is also what releases the reservation, so build it with the overselling fix.
- [ ] Public checkout has no rate limit. Matters more once checkout reserves stock, because spam orders could lock it up.
- [ ] Server doesn't validate stock amounts; negative values are saved.
- [ ] Product images from the form are saved as-is instead of keeping only the URL.
- [ ] Revenue chart sums the same month across different years.
- [ ] Deleting something still in use (e.g. a sold product) returns a generic English 500.
- [ ] Public single-product GET returns archived products.

## Low

- [ ] Store PATCH/DELETE return 200 instead of 403 for non-owners (still safe).
- [ ] CORS allows any origin (`*`).
- [ ] Some API error messages are English instead of Lithuanian.
- [ ] Price validation mismatch: UI requires ≥ 1 €, server accepts anything > 0.
- [ ] Dashboard product count is labelled like a stock count.
- [ ] TODO in code: catalog filtering happens in memory.
- [ ] Dependabot update runs failing since June (not investigated).

## Dead code / cleanup

- [x] Delete the empty untracked `pages/` folder (causes all 17 local `npm run typescript` errors).
- [x] Remove unused `components/ui/textarea.tsx`.
- [x] Remove unused `getPlainTextFromRichText`.
- [x] Remove `prettier.config.js` (overridden by `.prettierrc`).
- [x] Move `@neon/*` packages to devDependencies (tooling only).

## Customer accounts (after the Montonio migration)

Planned feature: optional customer accounts with order history, saved addresses and product reviews. Start with `/grill-me`, then `to-prd` to turn it into a detailed plan. The storefront side (sign-in, account pages, review form) belongs in the store repo and its design in Claude Design.

- [ ] **Separate Clerk application for customers.** Don't reuse the admin's Clerk app: any signed-in user there can create a store, so shoppers must not be able to log in to the admin. Turn off sign-up on the admin app.
- [ ] **Verify customer tokens in the API.** The storefront is on a different domain, so it sends the Clerk session token (`getToken()`) as an `Authorization: Bearer` header, and the API verifies it against the customer Clerk app. Clerk refreshes tokens itself: no custom refresh logic.
- [ ] **Data model.** Customer data lives in Prisma, linked by Clerk user ID: `customerId` on `Order`, new `Address` and `Review` models. Write the migration on the `dev` branch only.
- [ ] **Customer endpoints.** My orders, my addresses (create, edit, delete, default), and creating a review. Every handler checks that the record belongs to the signed-in customer.
- [ ] **Keep guest checkout.** Accounts are optional. Attach the order to the account when signed in; consider linking earlier guest orders by verified email.
- [ ] **Saved addresses in checkout.** Prefill delivery details from the default address when signed in.
- [ ] **Reviews.** Verified purchase only (the customer has a paid order with the product), one review per product per customer, moderation in the admin (approve or hide), and a "verified purchase" label plus a short note on how reviews are checked (EU consumer rules require disclosing this).
- [ ] **GDPR.** Account and data deletion (and export), and update the storefront's privacy policy to cover accounts and reviews.

## Customizable billboards

Banners become editable and more flexible. Design the layouts in Claude Design first (as part of the home page), then build the admin side, then the storefront side (see the store's TODO). Rules are in the store's DESIGN.md ("Density and promotions").

- [ ] **Extend the `Billboard` model.** Add a layout (text-over-left, text-over-center, split, image-only), eyebrow, title (today's `label`), subtitle, button text and link, light or dark text, image focus point, optional mobile image, and active start/end dates (like product sales). Migrate existing billboards so they keep working. Migration on the `dev` branch only.
- [ ] **Home banners managed in the admin.** Today the storefront shows one billboard chosen by its `INDEX_BILLBOARD_ID` env var. Replace that with a list of home banners: mark billboards for the home page, set their order, and return only active ones (within their dates) from a public endpoint.
- [ ] **Billboard form.** Layout picker, all new fields, mobile image upload (Cloudinary), focus point, dates, and a live preview of how the banner will look.
- [ ] **Keep the API backward compatible** until the storefront is updated: existing billboard responses keep `label` and `imageUrl`.
