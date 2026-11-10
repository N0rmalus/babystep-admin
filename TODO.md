# TODO

Findings from the 2026-10-24 audit, ranked by impact on a shop taking real orders.

Payments are moving from Stripe to Montonio. Don't spend time on Stripe-only fixes; the items below are written so they carry over.

## Product variants (plan before the overselling fix and Montonio)

Planned on 2026-11-07: every decision is in `docs/product-variants.md` (the source for `/to-prd`, one PRD per step). Terms in `GLOSSARY.md`, ADRs 0001 and 0002 in `docs/adr/`. Each step is committed separately and tested on `dev`.

- [x] **Step 1, admin.** Schema and `dev` migration (default variant per product), the "Savybės" page for store-level groups (Dydis, Spalva), the variant editor with bulk edit, image tags, the public product shape, catalog rules for variants, order item snapshot fields and the variant label helper.
- [ ] **Step 2, storefront.** See the store's TODO ("Product variants").
- [x] **Step 3, Montonio checkout.** Line items per variant, stock reservation and release, the cleanup route, review flags and the checkout error codes. Listed under "Checkout endpoints for the storefront" and "High".
- [ ] **Steps 4 and 5.** "Product specifications" (with the size guide) and "Product age range" use the shapes fixed in the plan.

## Montonio migration

High-level plan. How Montonio works is not researched yet: read their docs first and fill in the details from there.

- [x] **Research Montonio.** How orders are created and paid, how payment results reach us, which payment states exist, what customer data comes back, and whether it offers anything for shipping.
- [x] **Replace payment creation in checkout.** Done with a new contract (`CreateOrderInput` in, `{ orderId, paymentUrl }` out); the payment is linked to our `order.id`.
- [x] **Replace the payment webhook.** `app/api/webhook/route.ts`. Keep marking paid once, but stock is now reserved at checkout, so `PAID` no longer decrements stock or archives sold-out products (see "Stock and reservation" in `docs/product-variants.md`). Mark an order paid only once the payment is confirmed, and verify that the notification really comes from the provider.
- [x] **Charge shipping.** Today nothing is charged: the Stripe session has no shipping line, while the storefront shows 4,99 € and the delivery page promises 3,49 € (parcel locker) and 6,49 € (courier). Decide the delivery options and prices, then have checkout accept a delivery method, compute the price server-side, apply the free-shipping threshold and store it on the order.
- [x] **Keep collecting address and phone.** Stripe's hosted page collects them today (`billing_address_collection`, `phone_number_collection`) and the webhook copies them onto the order. Make sure orders still get them after the switch.
- [x] **Return customers to the storefront with our order ID** so the store can show a real confirmation (see the storefront TODO).
- [x] **Remove Stripe.** `lib/stripe.ts`, the `STRIPE_*` env vars and the `stripe` dependency.
- [x] **Update `CLAUDE.md` for Montonio.** It mentions Stripe in the stack list, the "Stripe: test mode only" rule and the `checkout` description. Replace them with Montonio, keeping a test-only rule for whatever test environment Montonio provides.

## High

- [x] **Overselling charges customers without a paid order.** (Planned: reserve per variant by decrementing at checkout, built in the Montonio checkout; see "Stock and reservation" in `docs/product-variants.md` and ADR 0002.) Checkout checks stock but doesn't reserve it; if two people pay for the last item, the second webhook fails with 500 and the order stays unpaid while the customer has paid. Fix it independently of the provider: reserve stock when the order is created in checkout, and release it when the order is cancelled or expires. `app/api/[storeId]/checkout/route.ts:76`, `app/api/webhook/route.ts:104`
- [ ] **Product PATCH can wipe all images.** Images are deleted and re-added in two separate steps; if the second fails the product has none. Do it in one transaction. `app/api/[storeId]/products/[productId]/route.ts:131-163`
- [ ] **Sale dates drift by the timezone offset on every save.** The form sends dates without a timezone and the server (UTC in prod) reads them as UTC, which can change the charged price. `product-form.tsx:65`, `product-form.tsx:113`

## Medium

- [x] Orders table: "Apmokėta" column is always blank, no date column, abandoned unpaid orders mixed with real ones. `orders/components/columns.tsx:179`
- [x] Unpaid orders are never cleaned up. Once stock is reserved, the cleanup job is also what releases the reservation, so build it with the overselling fix: the `release-reservations` cron route in `docs/product-variants.md`.
- [ ] Public checkout has no rate limit. Matters more once checkout reserves stock, because spam orders could lock it up.
- [ ] Server doesn't validate stock amounts; negative values are saved.
- [ ] Product images from the form are saved as-is instead of keeping only the URL.
- [ ] Revenue chart sums the same month across different years.
- [ ] Deleting something still in use (e.g. a sold product) returns a generic English 500.
- [ ] Public single-product GET returns archived products.

- [ ] **Price history for discount rules.** If the EU Omnibus requirement applies (see the storefront's "Price reductions" item), record each variant's price changes (products without variants through their default variant) so the API can return the lowest price of the last 30 days, and use it as the "before" price for sales. Do it before launch, so history starts recording early; until 30 days of history exist, use the current regular price as the reference.

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

## Product age range

The home page has a "Pagal amžių" section (0–6 mėn., 6–12 mėn., 1–3 m.) that is a mock in the storefront until this exists.

Dydis values carry an age range (see "Age picker" in `docs/product-variants.md`): a product with age-based sizes matches through its in-stock variants, and the product-level range below is the fallback for products without them.

- [ ] **Data model.** Add optional `ageFromMonths` and `ageToMonths` (Int) to `Product`. A range, not tags, so a 3–12 month product appears in both 0–6 and 6–12. Migration on the `dev` branch only.
- [ ] **Age groups in one place.** Define the groups (0–6, 6–12, 12–36 months, with Lithuanian labels) as one constant shared by the API and the form.
- [ ] **Product form.** Two number fields ("nuo" / "iki" mėn.) or age-group checkboxes, with validation (from ≤ to, no negatives).
- [ ] **API filter.** `?age=<group>` on the products endpoint returns products whose range overlaps the group. Products without an age range are left out of age results. Usable later as a catalog filter on category pages.

## Newsletter

The storefront shows a newsletter form that is a mock until this exists.

- [ ] **Choose an email service** (e.g. MailerLite, Brevo or Mailchimp; check EU data storage and the free tier).
- [ ] **Signup endpoint.** A public `POST` that validates the email and adds it to the list with double opt-in (a confirmation email), with rate limiting.
- [ ] **Consent.** Record when and where the person signed up, and make unsubscribing work. Cover it in the privacy policy.

## Product specifications

Structured "Papildoma informacija" shown on the product page, next to the rich-text description.

- [ ] **Data model.** Label/value specification rows per product (e.g. Matmenys, Medžiaga, Sudėtis, Priežiūra), ordered. A row can vary by one option group, with a value per option value (e.g. dimensions per Dydis), not per variant. The size guide is built from these rows plus the Dydis height and weight ranges (see "Specifications and size guide" in `docs/product-variants.md`). Migration on the `dev` branch only.
- [ ] **Consistent labels.** A shared list of common labels to pick from (free text still allowed), so the same spec is spelled the same everywhere and can become a catalog filter later.
- [ ] **Product form and API.** Edit the rows in the product form; include them in the public product response.

## Checkout endpoints for the storefront

The storefront's checkout (`../babystep-store/docs/design/checkout/`) needs these public endpoints. Montonio keys stay in the admin.

- [x] **Delivery options:** carriers, prices and the free-shipping threshold from one shared config (see Decisions in `docs/montonio-research.md`).
- [x] **Pickup points:** proxy Montonio Shipping `GET /shipping-methods/pickup-points` for Omniva and Unisend parcel machines in LT, merged into one list, cached (e.g. for a day).
- [x] **Payment methods:** proxy `GET /stores/payment-methods`, returning Lithuanian banks (`name`, `code`, `logoUrl`) and whether cards are enabled. Cache it.
- [x] **Create order:** the new checkout request (line items with variants, delivery, contact, payment method + bank code), stock reservation, Montonio order, returns `paymentUrl`. Line items, reservation, release and error codes as in `docs/product-variants.md`.
- [x] **Order status by our order ID** for the confirmation page.
- [ ] **Order confirmation email** (choose a provider; the newsletter service may cover transactional email).
- [ ] **Promo codes:** create and manage codes in the admin, validate them in the checkout request and apply the discount server-side.

## Migration from WordPress

The plan lives in the storefront's TODO ("Migration from WordPress"). Admin side:

- [ ] **Montonio keys: never regenerate the live store's keys.** The live WordPress shop uses that Montonio store's production keys; regenerating invalidates them. Develop with sandbox keys, ideally from a separate Montonio store for the new site. Decide with Montonio which store the new site uses at launch.
- [ ] **Products by hand.** Enter products and variants by hand in the new admin (no importer). On switch-over day, update stock numbers from WooCommerce.
- [ ] **Data imports** (reviews, maybe customers and orders) into the `dev` branch first, then `prod` at switch-over.
