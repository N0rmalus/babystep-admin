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

- [ ] Delete the empty untracked `pages/` folder (causes all 17 local `npm run typescript` errors).
- [ ] Remove unused `components/ui/textarea.tsx`.
- [ ] Remove unused `getPlainTextFromRichText`.
- [ ] Remove `prettier.config.js` (overridden by `.prettierrc`).
- [ ] Move `@neon/*` packages to devDependencies (tooling only).
