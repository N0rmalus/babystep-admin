# Montonio research (Stripe → Montonio migration)

Researched 2026-10-30 from Montonio's official docs (docs.montonio.com), help center (help.montonio.com), montonio.com and Montonio's GitHub. Every Montonio claim links to the page it came from. Anything not found there is marked **Unconfirmed**.

Related plans: `babystep-admin/TODO.md` ("Product variants", "Montonio migration", overselling item under "High") and `babystep-store/TODO.md` (delivery method selection, order confirmation page).

## TL;DR

- Montonio Payments ("Stargate") is a JWT API: we sign the order with our **Secret Key** (HS256), POST it to `/api/orders`, get back a `paymentUrl` and redirect the customer there. [Orders guide](https://docs.montonio.com/api/stargate/guides/orders)
- **We must pick the payment method when creating the order** (`payment.method` is required). For bank links we can omit the bank and Montonio shows its own bank picker. Whether the hosted page also offers cards or other methods is **Unconfirmed**. [Orders guide](https://docs.montonio.com/api/stargate/guides/orders)
- Results come by webhook to the per-order `notificationUrl` as `{ "orderToken": "<JWT>" }`, plus an `order-token` query param on the `returnUrl` redirect. Verify the HS256 signature with the Secret Key, then check `paymentStatus === 'PAID'`, `uuid` and `accessKey`. Montonio retries non-2xx responses for 48 hours. [Webhooks guide](https://docs.montonio.com/api/stargate/guides/webhooks)
- Statuses: `PENDING`, `PAID`, `VOIDED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `ABANDONED` (after 30 min by default), `AUTHORIZED` (opt-in, enterprise only). [Overview](https://docs.montonio.com/api/stargate/overview)
- **Montonio's Orders API is not documented to collect address or phone.** Unlike Stripe Checkout, we have to collect name, email, phone and address (or pickup point) in our own checkout and send them as `billingAddress`/`shippingAddress`. So the `{ productIds }` → `{ url }` contract cannot stay unchanged: delivery method and customer details must be added.
- Montonio Shipping is a separate API (same key style). Lithuanian carriers under a **Montonio contract**: Omniva, SmartPosti, Unisend (parcel machines), Omniva and SmartPosti (courier). Under **direct contracts** DPD and Venipak are also available. [Available methods](https://help.montonio.com/en/articles/174881-available-shipping-methods-and-countries-in-montonio)
- **No embeddable pickup-point picker widget is documented** for custom integrations. We fetch pickup points from the API and build our own selector. [Shipping methods guide](https://docs.montonio.com/api/shipping-v2/guides/shipping-methods)
- **We set the price the customer pays for shipping.** Montonio's `rates` endpoint returns our contract cost, not a customer price. Montonio only adds shipping to the payment for Payment Links (`showShippingOptions`), not the Orders API. [Shipping reference](https://docs.montonio.com/api/shipping-v2/reference), [Payment links](https://docs.montonio.com/api/stargate/guides/payment-links)
- Sandbox: separate keys from the Partner System, base URL `https://sandbox-stargate.montonio.com/api`, and published test cards. No test bank credentials are published. [Embedded cards](https://docs.montonio.com/api/stargate/guides/embedded-cards), [Sandbox keys](https://help.montonio.com/en/articles/27851-where-to-find-sandbox-api-keys)

## Decisions (owner, 2026-10-30)

These answer "Open decisions for the owner" below and are what later sessions build on.

**Plan:** Montonio **Core** is active (bank payments 0,05 €, cards 1,29 % + 0,20 €, branded tracking page and emails, direct carrier contracts possible). Fees are without VAT.

**Delivery** (customer prices include VAT; Montonio costs from the pricing page, without VAT):

| Option | Carrier | Customer price | Our cost | Free shipping |
| --- | --- | --- | --- | --- |
| Parcel locker | Omniva | 3,49 € | 2,40 € | from 80 € |
| Parcel locker | Unisend | 3,49 € | 2,05 € | from 80 € |
| Home delivery (courier) | SmartPosti | 6,49 € | 5,25 € | from 80 € |

- One locker price for both networks. The pickup-point selector lists Omniva and Unisend lockers together.
- Free shipping from 80 € applies to every option, courier included. The threshold and prices live in one place, shared by the API and the storefront.
- The flat 4,99 € (`STANDARD_SHIPPING_PRICE`) goes away. The delivery page (`pristatymo-informacija`) must show these carriers and prices (Unisend instead of LP Express).
- Kuršių Nerija exception: not decided; leave it out unless the owner asks.
- DPD: not at launch (would need a direct contract, 5 €/month on Core).

**Shipping operations:** Montonio Shipping on Montonio's contract. At first, shipments and labels are created **manually in the Partner System**; automate later. Courier pickup is free for Unisend and SmartPosti; Omniva pickup costs 4 € below 5 parcels, so batch Omniva parcels or drop them off. Use Montonio's branded tracking page and emails (set up in the Partner System) instead of our own shipping notifications.

**Payment methods:** bank links (listed first: cheapest) and cards / Apple Pay / Google Pay via Montonio's hosted pages. No Pay Later or financing at launch.

**Checkout:** our own checkout step (required: the Orders API doesn't collect customer data): delivery method with pickup-point selector or courier address, contact details (name, email, phone), payment method. Then a confirmation page keyed on our order ID that reads the order status.

**Unpaid and failed payments:**
- Stock is reserved for **30 minutes** (`expiresIn: 30`) when the order is created.
- On `ABANDONED` (or expiry): release the reserved stock and keep the order, marked as abandoned.
- `VOIDED` after `PAID`: flag the order for manual handling.
- We send our own order confirmation email (service to be chosen; the newsletter provider may cover transactional email).

**Refunds:** done in Montonio's Partner System at first. The webhook only needs to record refund statuses if that's simple.

**Rollout:** the store isn't live, so both repos switch together. **No backward compatibility** with `{ productIds }`; the new checkout request (line items with variants, delivery, contact, payment method) replaces it.

**Keys:** development uses **sandbox keys only**. Production keys live only in Vercel when going live.

**Still to confirm with Montonio:** when the monthly fee is charged; whether Unisend is LP Express; whether they offer a pickup-point selector for custom integrations; whether parcels can be dropped off at Omniva parcel machines; the calculator showed slightly lower rates (Unisend 1,99 €, Omniva 2,30 € / courier 5,50 €) than the pricing page used above.

## Current setup (checked 2026-10-31)

What the live WordPress/WooCommerce shop at babystep.lt and the Montonio account look like today.

**Montonio account:** one store, "Babystep" (https://babystep.lt), approved. It has live keys (used by the WordPress shop; **never regenerate**) and sandbox keys (use these for development).

**Montonio payments, live:** active: bank payments, card payments (Adyen: cards, Apple Pay, Google Pay, MobilePay), payment links, Pay Later, financing, BLIK. Inactive: refundable bank payments. The new checkout offers bank payments and cards / Apple Pay / Google Pay only (Pay Later and financing stay off in our checkout, per Decisions).

**WordPress checkout payments:** the Montonio WooCommerce plugin's "Montonio Bank Payments" method (bank links). The new site adds cards, Apple Pay and Google Pay.

**Montonio carriers:** none activated. WordPress shipping does **not** go through Montonio. When the shipping work starts, activate Omniva, Unisend and SmartPosti with Montonio's rates ("Get started" on each). This doesn't affect the WordPress shop.

**Montonio add-ons:** active: courier pickup, pick list, label printing. Inactive: order tracking page, order tracking emails (their "Activate" is greyed out, probably until a carrier is active), parcel delay notifications. Activate tracking page and emails after the carriers.

**WordPress shipping today:** Omniva parcel machines, LP Express parcel machines and LP Express courier enabled; Omniva courier disabled. Lockers 3,49 €, courier 6,49 €, free from 80 €, 0–30 kg. The new site keeps the prices and threshold; LP Express becomes Unisend (its new name) for lockers, and the courier moves to SmartPosti (Montonio's contract has no Unisend courier from Lithuania).

**WordPress shipping plugin:** "MultiParcels Pristatymas WooCommerce" (MultiParcels, a separate shipping-integration service with its own account). After the switch to Montonio Shipping, the MultiParcels plugin and subscription can be retired.

**Still unknown:** whether the carriers in MultiParcels run on MultiParcels' rates or on the shop's own contracts with Omniva / LP Express (check the carrier settings in the MultiParcels account). If there are own contracts with better rates, they could be connected to Montonio as direct contracts (5 €/carrier/month on Core) instead of Montonio's rates.

## Partner System setup checklist (owner)

Things only the owner can do in Montonio's Partner System. Development needs only steps 1–4.

1. **Store:** make sure a store exists for Babystep (Business settings → Stores).
2. **Sandbox API keys:** Stores → API Keys → Sandbox. Copy the Access Key and Secret Key into `babystep-admin/.env` as `MONTONIO_ACCESS_KEY` / `MONTONIO_SECRET_KEY`, with `MONTONIO_API_URL=https://sandbox-stargate.montonio.com/api`. Never paste them into chat or commit them.
3. **Payment methods:** enable bank payments and cards (Apple Pay and Google Pay come with cards) for the store. Leave Pay Later off.
4. **Shipping:** activate Omniva and Unisend parcel machines and SmartPosti courier on Montonio contracts (sandbox uses dummy carrier credentials). Find out whether the shipping API uses the same keys.
5. **Branded tracking:** upload the logo and colors for the tracking page and emails (Core plan).
6. **Before launch only:** production keys go into Vercel's environment variables, never into the local `.env`.

Webhooks: Montonio has to reach `notificationUrl` over the internet, so `localhost` won't work. Test webhooks on a Vercel preview deployment (with the sandbox keys in Vercel's Preview environment) or through a tunnel such as `cloudflared` / `ngrok`. Montonio's help article "How to test order webhooks locally" covers this.

## Our current Stripe flow

### Admin

- **Checkout contract:** body `{ productIds?: string[] }`. A repeated ID means quantity. `app/api/[storeId]/checkout/route.ts:10-12`, `:14-19`, `:54`
- **Validation:** products must be active (`:57-74`). Stock is checked but not reserved (`:76-92`).
- **Prices:** effective price per product, from `getProductEffectivePrice` (`:94-96`). Stripe line items use cents (`:98-111`).
- **Order:** created before payment with `isPaid: false` and one `OrderItem` per repeated ID with `unitPrice` (`:113-128`). No total, no shipping, no customer data.
- **Stripe session:** `billing_address_collection: 'required'`, `phone_number_collection` (`:133-136`). Return URLs are `FRONTEND_STORE_URL/cart?success=1` / `?canceled=1` (`:137-138`). `orderId` is passed in `metadata` (`:139-141`). Response is `{ url }` (`:144`).
- **No shipping charged:** the session has no shipping line (`:130-142`).
- **Webhook** `app/api/webhook/route.ts`:
  - Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` (`:17-31`) and handles only `checkout.session.completed` (`:33-35`).
  - Reads `orderId` from metadata (`:38-42`). Flattens the Stripe billing address into one string and reads the phone (`:44-54`).
  - Transaction (`:57-122`): marks paid once using `updateMany where isPaid: false` (`:71-85`), which is the idempotency guard. Then it decrements stock per product with a `gte` guard and throws `INSUFFICIENT_STOCK` if that fails (`:89-107`), and archives products at ≤ 0 stock (`:109-121`).
  - Any error returns 500 so the provider retries (`:123-127`).
- **Stripe client:** `lib/stripe.ts:1-6` (`STRIPE_API_KEY`, apiVersion `2023-08-16`).
- **Env:** `.env.example:20-22` (`STRIPE_API_KEY`, `FRONTEND_STORE_URL`, `STRIPE_WEBHOOK_SECRET`).
- **Data model:** `Order` has `id`, `storeId`, `isPaid`, `phone`, `address` (single string), timestamps (`prisma/schema.prisma:103-115`). `OrderItem` has `productId` and nullable `unitPrice` (`:117-127`).

### Storefront

- **Checkout call:** POST `${NEXT_PUBLIC_API_URL}/checkout` with `{ productIds }` (`hooks/use-cart-summary.ts:69-73`). The reply is checked for `url`, then the browser redirects (`:104-109`). Error payloads with `invalidProductIds` / `insufficientStockItems` show toasts (`:76-101`).
- **Shipping shown in the cart:** flat `STANDARD_SHIPPING_PRICE` 4.99, free from `FREE_SHIPPING_THRESHOLD` 80 (`lib/consts.ts:5-6`, `hooks/use-cart-summary.ts:47-51`). It is never sent to the API.
- **Delivery page:** promises Omniva and LP Express parcel lockers at 3,49 € and courier at 6,49 €, free from 80 € except Kuršių Nerija (`app/(routes)/pristatymo-informacija/page.tsx:8-21`, `:44`, `:61-66`).
- **Return handling:** `?success` → toast "Mokėjimas atliktas." and clears the cart. `?canceled` → "Kažkas nepavyko." (`app/(routes)/cart/components/summary.tsx:39-48`). There is no confirmation page and no order ID.

## Montonio Payments (Stargate)

### Environments and auth

- **Base URLs:** production `https://stargate.montonio.com/api`, sandbox `https://sandbox-stargate.montonio.com/api`. [Overview](https://docs.montonio.com/api/stargate/overview), [Reference](https://docs.montonio.com/api/stargate/reference)
- **Keys:** each store has an **Access Key** and a **Secret Key**, generated in the Partner System (Stores → API Keys). Generating new keys invalidates the old ones. Sandbox keys are available right after sign-up. Production keys come only after the business is approved. [Introduction](https://docs.montonio.com/introduction)
- **Sandbox and production keys can't be mixed.** [Sandbox keys](https://help.montonio.com/en/articles/27851-where-to-find-sandbox-api-keys)
- **JWT signing:** every request is a JWT signed HS256 with the Secret Key, with header `{ alg: 'HS256', typ: 'JWT' }`. The payload must include `accessKey` and `exp`. [Reference → Authentication](https://docs.montonio.com/api/stargate/reference)
  - GET requests send `Authorization: Bearer <jwt>`.
  - POST requests send the JWT as the body, `{ "data": "<jwt>" }`.
  - The orders guide sets `exp` 10 minutes ahead for order creation. The reference recommends 1 hour for API tokens in general. [Orders guide](https://docs.montonio.com/api/stargate/guides/orders)
- **Endpoints:** `GET /stores/payment-methods`, `POST /orders`, `GET /orders/:orderUuid`, `POST /refunds`, `POST /payment-links`, `POST /sessions` (embedded cards). [Reference](https://docs.montonio.com/api/stargate/reference)
- A Postman collection is linked from the docs: `https://public.montonio.com/assets/postman_collection/montonio-api-postman.zip`. [Introduction](https://docs.montonio.com/introduction)

### Creating an order (`POST /orders`)

All fields below are from the [Orders guide](https://docs.montonio.com/api/stargate/guides/orders).

| Field | Required | Notes |
|---|---|---|
| `accessKey` | yes | |
| `merchantReference` | yes | Our order ID. "must be unique for each order of a store". Reusing it **updates** the existing Montonio order. |
| `returnUrl` | yes | Customer is sent here after paying or cancelling. |
| `notificationUrl` | yes | Webhook target, set per order. |
| `grandTotal` | yes | Number, up to 2 decimals (not cents). |
| `currency` | yes | `EUR` (or `PLN`). |
| `locale` | yes | Includes `lt`. |
| `exp` | yes | JWT expiry. |
| `expiresIn` | no | Minutes the order can be paid. Default 30, min 5, max 44640. |
| `billingAddress`, `shippingAddress` | no | `firstName`, `lastName`, `email`, `phoneNumber`, `phoneCountry`, `addressLine1`, `addressLine2`, `locality`, `region`, `postalCode`, `country`. Montonio recommends providing "as much information as possible". |
| `lineItems` | no | If sent, every item needs `name`, `quantity` (int) and `finalPrice` (tax included). |
| `payment` | yes | `method`, `amount` (= `grandTotal`), `currency`. Optional `methodDisplay`, `methodOptions`. |
| `sessionUuid` | embedded cards only | |

- **`payment.method` values:** `paymentInitiation`, `cardPayments`, `applePay`, `googlePay`, `mobilePay`, `blik`, `hirePurchase`, `bnpl`. The docs say the method "defines which payment gateway the customer will be redirected to".
- **`methodOptions` for `paymentInitiation`:** `preferredProvider` (bank code; "Leave this blank to let the customer choose their bank in our interface"), `preferredCountry` (`LT`), `preferredLocale`, `paymentDescription`, `paymentReference`.
- **`methodOptions` for `bnpl`:** `period` 1, 2 or 3 (required). [Financing](https://docs.montonio.com/api/stargate/guides/financing)
- **Response:** `uuid` (the Montonio order UUID, which we store), `paymentUrl` (redirect here), `paymentStatus`, `merchantReference`, `expiresAt`, addresses, line items and more.
- **Errors:** 400 invalid payload, 401 `STORE_NOT_FOUND` (wrong access key or environment), 403 wrong secret key or environment.
- There is no shipping field. Shipping is sent as an extra line item and included in `grandTotal`. The docs do not show an example of this, but `lineItems` is generic.
- Shape from the docs, trimmed:

```js
{
  accessKey, merchantReference: 'MY-ORDER-ID-123',
  returnUrl: 'https://mystore.com/payment/return',
  notificationUrl: 'https://mystore.com/payment/notify',
  currency: 'EUR', grandTotal: 99.99, locale: 'et',
  lineItems: [{ name: 'Hoverboard', quantity: 1, finalPrice: 99.99 }],
  payment: {
    method: 'paymentInitiation', amount: 99.99, currency: 'EUR',
    methodOptions: { preferredCountry: 'EE', preferredProvider: 'LHVBEE22', paymentDescription: 'Payment for order 123' },
  },
}
```

### Payment method selection

- The integration checklist expects us to fetch available methods (`GET /stores/payment-methods`) and **display them to the customer** before creating the order. [Checklist](https://docs.montonio.com/api/stargate/checklist)
- `GET /stores/payment-methods` returns enabled methods with logos. Banks are grouped by country under `paymentInitiation.setup.<COUNTRY>.paymentMethods[]` (`name`, `code`, `logoUrl`, `uiPosition`, `supportedCurrencies`). An empty list means nothing is enabled for the store. [Payment methods guide](https://docs.montonio.com/api/stargate/guides/payment-methods)
- **Bank picker widget:** a script (`https://public.montonio.com/assets/montonio-js/3.x/montonio.bundle.js`, `MontonioLegacy.Checkout.PaymentInitiation`) renders bank choices from the `stores/payment-methods` data. It only covers banks: "For other methods (cards, BLIK, financing, etc.) you should use your own UI elements." [UI widgets](https://docs.montonio.com/api/stargate/widgets)
- **Embedded cards:** `@montonio/montonio-js` (`MontonioCheckout`) renders card fields in our page using `POST /sessions` → `sessionUuid`. [Embedded cards](https://docs.montonio.com/api/stargate/guides/embedded-cards), [montonio-js](https://github.com/montonio/montonio-js)
- **Unconfirmed:** whether Montonio's hosted `paymentUrl` page lets the customer switch to a different method type (for example from bank to card). The docs only describe a bank selection page when `preferredProvider` is empty. Payment Links do offer a hosted page "without you needing to build a UI to select payment methods". [Payment links](https://docs.montonio.com/api/stargate/guides/payment-links)

### How the result reaches us

- **Webhook:** Montonio POSTs `{ "orderToken": "<JWT>" }` to the order's `notificationUrl` "whenever an order transitions from one status to another". Refund status changes go to the same URL as `{ "refundToken": "<JWT>" }`. [Webhooks guide](https://docs.montonio.com/api/stargate/guides/webhooks), [Overview](https://docs.montonio.com/api/stargate/overview)
- **Redirect:** the customer returns to `returnUrl` with an `order-token` query param (the same JWT). The checklist says it can be used for synchronous validation, but webhooks stay the primary source of truth. [Orders guide](https://docs.montonio.com/api/stargate/guides/orders), [Checklist](https://docs.montonio.com/api/stargate/checklist)
- **Verification steps** ([Orders guide](https://docs.montonio.com/api/stargate/guides/orders)):
  1. Verify the JWT signature with the Secret Key (HS256). Reject the request if it fails.
  2. Check `paymentStatus === 'PAID'`.
  3. Check that `uuid` matches the Montonio order UUID we stored.
  4. Check that `accessKey` matches ours.
  - Our own extra check (not from Montonio): `merchantReference` = our order ID, and `grandTotal`/`currency` match the order total.
- **Decoded token fields:** `uuid`, `accessKey`, `merchantReference`, `merchantReferenceDisplay`, `paymentStatus`, `paymentMethod`, `grandTotal`, `currency`, `senderIban`, `senderName` (when available and paid), `paymentProviderName`, `iat`, `exp`. Snake_case duplicates are being removed. **No address, email or phone in the token.** [Orders guide](https://docs.montonio.com/api/stargate/guides/orders)
- **Retries:** if we don't answer 200/201, Montonio retries 13 times over 48 hours. [Orders guide](https://docs.montonio.com/api/stargate/guides/orders), [Webhooks guide](https://docs.montonio.com/api/stargate/guides/webhooks)
- **Duplicates:** duplicates are possible, so dedupe by order UUID. There is no separate idempotency key. Montonio recommends answering fast and processing async. [Webhooks guide](https://docs.montonio.com/api/stargate/guides/webhooks)
- **Sender IPs:** `35.156.245.42` and `35.156.159.169`. User-Agent `MontonioWebhooks/1.0`. [Webhooks guide](https://docs.montonio.com/api/stargate/guides/webhooks)
- **Status lookup:** `GET /orders/:uuid` returns current status, `paymentIntents`, refunds, and the addresses and line items we sent. [Reference](https://docs.montonio.com/api/stargate/reference)

### Payment statuses

From the [Overview](https://docs.montonio.com/api/stargate/overview):

| Status | Meaning |
|---|---|
| `PENDING` | Created, customer has not paid yet. This is the first status. |
| `PAID` | Customer has paid. |
| `VOIDED` | A previously `PAID` order was rejected by the bank. Only happens with `paymentInitiation`. The merchant gets an email. |
| `PARTIALLY_REFUNDED` | Part of the amount was refunded. |
| `REFUNDED` | The full amount was refunded. |
| `ABANDONED` | Still `PENDING` after 30 minutes by default, and a webhook is sent. Enabled for merchants who started after 2023-08-29. |
| `AUTHORIZED` | Opt-in, select enterprise customers only. Bank payment signed but not yet processed. |

Refund statuses: `PENDING`, `PROCESSING`, `SUCCESSFUL`, `REJECTED`, `CANCELED`.

Implications for us:
- `ABANDONED` is a natural trigger for releasing reserved stock.
- **Unconfirmed:** whether `ABANDONED` follows `expiresIn` when we set it, or always the 30-minute default.
- `VOIDED` after `PAID` means "paid" is not 100 % final for bank payments. We need a way to flag such orders; the bank also emails the merchant.

### Customer data

- The Orders API docs don't say the hosted payment page collects name, email, phone or address. The webhook token carries no customer contact data. **Unconfirmed** whether the gateway collects any of it for the Orders API. Plan to collect it ourselves.
- `GET /orders/:uuid` returns `billingAddress`/`shippingAddress` (also `companyName`, `companyRegCode`, `companyVatNumber`), but these are the values we sent. [Reference](https://docs.montonio.com/api/stargate/reference)
- `senderName`/`senderIban` come from the payer's bank, only when available and `PAID`. [Orders guide](https://docs.montonio.com/api/stargate/guides/orders)
- Payment Links are the exception: `askAdditionalInfo: true` makes the gateway ask for first name, last name and email. With `showShippingOptions: true` it also asks for a mobile phone, a carrier and a pickup point, and adds the shipping cost. A full address is not mentioned. Payment Links are not the cart checkout flow, and the docs don't list these fields in the token. [Payment links](https://docs.montonio.com/api/stargate/guides/payment-links)

### Payment methods for Lithuania

- **Bank payments:** the docs' example response lists LT banks, but the actual list comes from our store's `GET /stores/payment-methods`. [Payment methods guide](https://docs.montonio.com/api/stargate/guides/payment-methods)
  - Example codes: Swedbank `HABALT22`, SEB `CBVILT2X`, Luminor `AGBLLT2X`, Artea `CBSBLT26`, Citadele `INDULT2X`, Revolut `RVUALT2V`, N26 `NTSBDEB1`, Wise `TRWIGB2L`.
  - **Unconfirmed** whether this is the complete current list for Lithuania. Notably Šiaulių bankas and Medicinos bankas are not in the example.
- **Cards, Apple Pay, Google Pay:** EUR and PLN. Marked `requiredToBeEnabled` in the methods response. Pricing says cards, Apple Pay and Google Pay are "always included" on Starter and Core. [Overview](https://docs.montonio.com/api/stargate/overview), [Payment methods guide](https://docs.montonio.com/api/stargate/guides/payment-methods), [Pricing](https://www.montonio.com/pricing)
- **BNPL ("Pay Later") and Hire Purchase ("Financing"):** EUR, through Inbank, available in EE, LV and LT. [Financing](https://docs.montonio.com/api/stargate/guides/financing)
  - BNPL limits in LT: 100–800 € (next month), 100–2,500 € (2 or 3 parts).
  - Hire purchase limits: 100–5,000 € (raisable to 10,000 €), 3–72 months, with the contract signed on Inbank's site.
  - With our 80 € free-shipping threshold, many baskets fall below the 100 € LT minimum.
- **MobilePay:** EUR. **BLIK:** PLN only, so it is not relevant for an EUR shop. Whether MobilePay works for Lithuanian customers is **Unconfirmed**. [Overview](https://docs.montonio.com/api/stargate/overview)
- **Delayed or non-instant payments:**
  - `AUTHORIZED` is only for opt-in enterprise customers.
  - `VOIDED` can follow `PAID` for bank payments.
  - **Unconfirmed:** how BNPL and hire purchase approvals map to statuses. The financing guide doesn't say whether the order stays `PENDING` during Inbank approval, or how long that can take.
- **Fees** (pricing page, 2026-10-30, EUR excl. VAT, apply to EE/LV/LT) [Pricing](https://www.montonio.com/pricing):
  - Starter: 11.99 €/mo. Cards 1.49 % + 0.25 €. Bank 0.20 €. Pay Later 2.90 %.
  - Core: 14.99 €/mo. Cards 1.29 % + 0.20 €. Bank 0.05 €. Pay Later 2.49 %.
  - Core Flex: 39.99 €/mo.
  - Financing is free for the merchant.

## Montonio Shipping (API v2)

- **Separate API:** production `https://shipping.montonio.com/api/v2`, sandbox `https://sandbox-shipping.montonio.com/api/v2`. Same JWT scheme (Bearer, HS256, `accessKey` + `exp`). [Overview](https://docs.montonio.com/api/shipping-v2/overview), [Reference](https://docs.montonio.com/api/shipping-v2/reference)
  - **Unconfirmed:** whether the shipping keys are the same key pair as the payments keys. The docs link to the general API keys section without saying.
- **Flow:** create a webhook → fetch shipping methods → create a shipment → create a label file. [Overview](https://docs.montonio.com/api/shipping-v2/overview)
- **Methods:** types `courier` (subtypes `standard`, `standardB2B`) and `pickupPoint` (`parcelMachine`, `parcelShop`, `postOffice`). [Shipping methods guide](https://docs.montonio.com/api/shipping-v2/guides/shipping-methods)
  - `GET /shipping-methods` lists methods per country and carrier.
  - `GET /shipping-methods/pickup-points?carrierCode=&countryCode=&type=` returns points with `id`, `name`, `type`, `streetAddress`, `locality`, `postalCode`, `carrierCode`.
  - `GET /shipping-methods/courier-services` lists courier services.
- **Pickup-point picker:** no embeddable picker widget is documented in the v2 docs. The only front-end libraries are for payments. We'd build our own selector from the pickup-points endpoint. [Shipping methods guide](https://docs.montonio.com/api/shipping-v2/guides/shipping-methods), [UI widgets](https://docs.montonio.com/api/stargate/widgets), [montonio-js](https://github.com/montonio/montonio-js)
- **Carriers shipping from Lithuania** [Available methods, dated 2026-06-24](https://help.montonio.com/en/articles/174881-available-shipping-methods-and-countries-in-montonio):

  | | Montonio contract | Direct contract |
  |---|---|---|
  | Parcel machine | Omniva, SmartPosti, Unisend | Omniva, DPD, SmartPosti, Venipak, Unisend |
  | Courier | Omniva, SmartPosti | Omniva, DPD, SmartPosti, Venipak, Unisend |
  | Post office | none | Omniva (EE only), SmartPosti (FI only) |

  - **LP Express:** our delivery page names LP Express. Montonio's pages list **Unisend**, not LP Express. Montonio's Unisend page doesn't say whether Unisend is the same service as LP Express, so this is **Unconfirmed** in Montonio's docs. [Unisend](https://help.montonio.com/en/articles/185095-unisend-by-montonio)
  - **Carrier codes:** the API reference shows `smartpost`, `omniva`, `dpd`, `venipak` as examples. The Unisend code and the full list are **Unconfirmed** (`GET /carriers` returns them). [Reference](https://docs.montonio.com/api/shipping-v2/reference)
  - The [Montonio-contracts page](https://help.montonio.com/en/articles/219852-shipping-with-montonio-special-prices) lists DPD with Montonio pricing in general. The Lithuania table above does not include DPD under Montonio contracts. Treat DPD from LT as **direct contract only** until Montonio confirms otherwise.
- **Pricing and contracts** [Montonio contracts](https://help.montonio.com/en/articles/219852-shipping-with-montonio-special-prices), [Reference](https://docs.montonio.com/api/shipping-v2/reference):
  - With a Montonio contract, Montonio replaces the carrier contract. It uses flat pricing per parcel size and sends one invoice.
  - Direct carrier contracts cost 5 €/carrier/month on Core and aren't available on Starter.
  - `POST /shipping-methods/rates` returns rates "based on your store's contract pricing", and only for carriers with Montonio contracts. This is **our cost**. What the customer pays is our decision. The pricing page says "Ship for just €1.99/parcel"; per-carrier rates are in the [shipping calculator](https://shipping-calculator.montonio.com) (not checked). [Pricing](https://www.montonio.com/pricing)
- **Shipments:** `POST /shipments` [Reference](https://docs.montonio.com/api/shipping-v2/reference), [Shipments guide](https://docs.montonio.com/api/shipping-v2/guides/shipments):
  - `shippingMethod { type, id }`: the pickup point ID or the courier service ID.
  - `receiver`: `name` and phone are required. Street, city, postcode and country are required for courier.
  - `parcels[].weight` is required.
  - Optional fields: `merchantReference`, `montonioOrderUuid` (links the shipment to the payments order), `products`.
  - Creation is async by default. `synchronous: true` makes it synchronous.
  - Shipments can only be updated in `registered` or `registrationFailed`.
- **Shipment statuses:** `pending`, `registered`, `registrationFailed`, `labelsCreated`, `inTransit`, `awaitingCollection`, `delivered`, `returned`. Label files are `pending`, `ready` or `failed`. A label file is a PDF. [Overview](https://docs.montonio.com/api/shipping-v2/overview)
- **Tracking:** `parcels[].carrierParcelId` and `parcels[].trackingLink` (null until registered). A customer tracking page can be enabled in the Partner System. **Unconfirmed:** whether Montonio sends customers email or SMS notifications. [Reference](https://docs.montonio.com/api/shipping-v2/reference), [Shipments guide](https://docs.montonio.com/api/shipping-v2/guides/shipments)
- **Shipping webhooks** [Shipping webhooks](https://docs.montonio.com/api/shipping-v2/guides/webhooks):
  - Registered via `POST /webhooks` (max 10 per store).
  - Events: `shipment.registered`, `shipment.registrationFailed`, `shipment.statusUpdated`, `shipment.labelsCreated`, `labelFile.ready`, `labelFile.creationFailed`.
  - Body is `{ payload: <JWT> }` signed with the Secret Key.
  - Retry policy is **Unconfirmed**.
- **Tie to payments:** shipping is independent of the payment order except for the optional `montonioOrderUuid` link. With the Orders API, we add the shipping cost to `grandTotal` ourselves.
- **Sandbox:** carriers are activated with dummy credentials. Addresses and phones are not validated. Labels are dummies and there is no real tracking. How to simulate status changes is **Unconfirmed**. [Shipping sandbox](https://docs.montonio.com/api/shipping-v2/guides/sandbox)
- An older page at [docs.montonio.com/api/shipping](https://docs.montonio.com/api/shipping) documents `GET /pickup-points` without a widget. Whether it is deprecated in favour of v2 is **Unconfirmed**. Use v2, which is the one in the current sidebar.

## Sandbox and testing

- **Keys:** sandbox keys are in the Partner System (Home → "Get API Keys", or Business settings → Stores → API Keys → Sandbox). Test mode toggles exist in the Partner System. [Sandbox keys](https://help.montonio.com/en/articles/27851-where-to-find-sandbox-api-keys), [Introduction](https://docs.montonio.com/introduction)
- **Test cards (sandbox)** [Embedded cards](https://docs.montonio.com/api/stargate/guides/embedded-cards), [Testing cards](https://help.montonio.com/en/articles/157815-how-to-test-card-payments-in-your-store):
  - `5577 0000 5577 0004`, exp 03/30, CVC 737: success.
  - `5454 5454 5454 5454`, exp 03/30, CVC 737: success with 3DS.
  - Set `billingAddress.email` to `redirect-3ds-test@montonio.com` to test the redirect 3DS flow.
  - An invalid CVC fails the payment.
  - Orders must be at least 0.50 €.
- **Test bank flow:** **Unconfirmed.** No sandbox bank names or credentials are published in the pages read.
- **Local webhooks:** a help article exists ([How to test order webhooks locally](https://help.montonio.com/en/articles/70327-how-to-test-order-webhooks-locally)). It was not read.

## What has to change

### Admin

**Checkout route** (`app/api/[storeId]/checkout/route.ts`):
- **Request:** extend it beyond `{ productIds }`:
  - delivery method (and the pickup point ID or courier address)
  - customer first and last name, email, phone
  - payment method (and optional bank code)

  The TODO's plan to keep the contract unchanged only works if Montonio's hosted page collects address and phone, which is not documented (see Customer data). Accept old requests until the store ships, as the variants plan does for line items.
- **Totals:** compute the shipping price server-side from the delivery method, apply the free-shipping threshold, and send shipping as a `lineItems` entry. `grandTotal` = items + shipping. Replaces `:98-111`.
- **Order:** create our order first (`:113-128`) with the new fields.
- **Montonio JWT:** build it with `merchantReference = order.id`, `returnUrl = FRONTEND_STORE_URL/<confirmation route>?orderId=<order.id>`, `notificationUrl = <admin>/api/webhook/montonio` (or similar), `locale: 'lt'`, `currency: 'EUR'`, `billingAddress`/`shippingAddress`, `payment`, and `expiresIn` matched to the stock reservation window. Then `POST /orders`.
- **Response:** store the returned `uuid` on the order and return `{ url: paymentUrl }`.
- **Stock reservation:** do it here, per the overselling TODO. Release it on `ABANDONED` or expiry.

**Webhook route** (`app/api/webhook/route.ts`):
- **Parse and verify:** read JSON `{ orderToken }` and verify it with `jsonwebtoken` HS256 and `MONTONIO_SECRET_KEY`. Check `accessKey`, `uuid` = stored Montonio UUID, `merchantReference` = order ID, and amount.
- **On `PAID`:** run the existing transaction unchanged (`:57-122`); `updateMany where isPaid: false` already makes duplicate deliveries harmless.
- **Customer data:** it is no longer in the payload (`:44-54`). It must be saved at checkout instead.
- **`ABANDONED`:** mark the order and release reserved stock.
- **`VOIDED`:** flag the paid order for manual handling.
- **Refunds:** decide whether to handle `refundToken` / `REFUNDED` / `PARTIALLY_REFUNDED`.
- **Response codes:** return 200 fast. Return non-2xx only when we want a retry; retries run for 48 h.
- **Optional:** IP allowlist `35.156.245.42` and `35.156.159.169`.

**Return-page support:**
- Add a public endpoint like `GET /api/[storeId]/orders/:id/status` so the store's confirmation page can show the status without knowing Montonio.
- Optionally verify the `order-token` from the redirect, or call `GET /orders/:uuid` when the webhook hasn't arrived yet.

**Prisma** (`Order`, `prisma/schema.prisma:103-115`; migrate on the `dev` branch). Suggested fields, all our naming:
- `montonioOrderUuid`
- `paymentStatus` (enum mirroring Montonio's statuses), keeping or deriving `isPaid`
- `paymentMethod`
- `itemsTotal`, `shippingPrice`, `total`
- `deliveryMethod` (+ carrier), `pickupPointId` / `pickupPointName`
- `firstName`, `lastName`, `email`
- structured address instead of the single `address` string
- `paidAt`, `expiresAt` (reservation)
- later `shipmentId` / `trackingLink` if we use Montonio Shipping
- `OrderItem` unchanged except for the variant fields from the variants plan.

**Env vars:**
- Add `MONTONIO_ACCESS_KEY`, `MONTONIO_SECRET_KEY` and `MONTONIO_API_URL` (sandbox or production base URL).
- Optionally add `MONTONIO_SHIPPING_API_URL`.
- Keep `FRONTEND_STORE_URL`.
- Remove `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` (`.env.example:20-22`).

**Remove Stripe:** `lib/stripe.ts`, the `stripe` dependency, Stripe imports in both routes, and the Stripe mentions in `CLAUDE.md`. Add a "Montonio: sandbox keys only" rule.

### Storefront

- **Checkout step:** add one between the cart and Montonio. Either extend the cart summary or add a page such as `/apmokejimas` with:
  - **Delivery method:** parcel machine (carrier + our own pickup-point selector fed by an API endpoint that proxies Montonio's pickup points) or courier (address fields).
  - **Contact:** name, email, phone (LT format).
  - **Payment method:** a bank list from `stores/payment-methods` (proxied via our API; Montonio's bank widget is an option), card / Apple Pay / Google Pay, Pay Later if enabled.
- **Shipping price:**
  - Replace the flat `STANDARD_SHIPPING_PRICE` (`lib/consts.ts:6`, `hooks/use-cart-summary.ts:51`) with per-method prices shared with the API, ideally fetched from it.
  - Make `pristatymo-informacija/page.tsx:8-21` show the same prices and the same carriers ("LP Express" vs Unisend).
- **Checkout call:** `hooks/use-cart-summary.ts:69-73` sends the new fields. Error handling should also cover field validation errors.
- **Confirmation page** keyed on our order ID from `returnUrl`:
  - Polls our API for status: `PENDING` = "laukiama apmokėjimo", `PAID` = success (clear the cart), `ABANDONED` / not paid = retry option.
  - Replaces the `?success` / `?canceled` handling in `cart/components/summary.tsx:39-48`.
  - Montonio uses one `returnUrl` for both paid and cancelled, so the page must read the status rather than the URL.
- **Copy:** in Lithuanian with the informal "tu" tone. Update the privacy policy to name Montonio (and Inbank if BNPL is enabled).

## Open decisions for the owner

Resolved: see "Decisions" near the top.

1. **Delivery options and prices:**
   - Which carriers? Montonio-contract options from LT are Omniva, SmartPosti and Unisend lockers, plus Omniva and SmartPosti courier.
   - Keep 3,49 € locker / 6,49 € courier or pick new prices? Drop the 4,99 € flat rate.
   - Keep the Kuršių Nerija exception? We would have to detect it by postcode.
2. **Shipping provider:** Montonio Shipping (Montonio contract, one invoice, labels and tracking in one place) vs Montonio Shipping with direct contracts (5 €/carrier/month on Core) vs carriers' own APIs and contracts. Also whether to automate label creation at all, or create shipments manually in the Partner System at first.
3. **Free-shipping threshold:** keep 80 €? Does it apply to courier too, and which carriers?
4. **Checkout UI:**
   - Own checkout form with method selection (required by the Orders API) vs Payment Links. Payment Links have a hosted page with name, email, phone and parcel-machine selection, but are built for links, not carts, and don't return the customer data documented in the token.
   - Hosted card page vs embedded cards (`montonio-js`).
5. **Payment methods to enable:**
   - Bank links (cheapest at 0.05 € on Core) and cards / Apple Pay / Google Pay are the minimum.
   - Pay Later / financing: the LT minimum is 100 €. Is it worth the delayed-status handling?
6. **Plan:** Starter vs Core (fees above).
7. **Delayed and failed payments:**
   - Stock reservation length (`expiresIn`, default 30 min).
   - What to do on `ABANDONED`: release stock, keep or delete the order.
   - How to handle `VOIDED` after `PAID`: manual process?
   - Whether to send our own order confirmation email.
8. **Refunds:** handle refunds via the API and webhook in the admin, or only in the Partner System?
9. **Rollout:** keep accepting `{ productIds }` during the transition, or switch both repos together? Product variants are planned first, which changes the line-item contract anyway.

## Unconfirmed (could not verify in official docs)

- Whether the hosted `paymentUrl` page lets customers switch payment method types, and whether it collects name, email, phone or address for Orders API payments.
- How BNPL and hire purchase approvals map to order statuses, and how long they can stay pending.
- Whether `ABANDONED` timing follows a custom `expiresIn`.
- Whether the example LT bank list is complete. Šiaulių bankas and Medicinos bankas are not in the example.
- Whether MobilePay is usable by Lithuanian customers.
- Sandbox test bank names and credentials for bank payments.
- Whether Shipping API keys are the same key pair as Payments keys.
- Full carrier code list, including Unisend's code.
- Whether Montonio's "Unisend" is the same service as LP Express. Montonio's pages don't mention LP Express.
- Whether DPD is available from LT under a Montonio contract. The general contracts page lists DPD; the LT table does not.
- Shipping webhook retry policy, and how to simulate shipment status changes in sandbox.
- Customer email or SMS notifications from Montonio Shipping.
- Whether the older `docs.montonio.com/api/shipping` page is deprecated.
- Per-carrier shipping rates. The shipping calculator was not checked.

Pages not read: [How to test order webhooks locally](https://help.montonio.com/en/articles/70327-how-to-test-order-webhooks-locally), [Refunds guide](https://docs.montonio.com/api/stargate/guides/refunds), [API changes](https://docs.montonio.com/api/stargate/changes), the [shipping calculator](https://shipping-calculator.montonio.com), and the Lithuanian pricing page. All other pages listed were accessible.

## Sources

- https://docs.montonio.com/introduction
- https://docs.montonio.com/api/stargate/overview
- https://docs.montonio.com/api/stargate/checklist
- https://docs.montonio.com/api/stargate/guides/orders
- https://docs.montonio.com/api/stargate/guides/payment-methods
- https://docs.montonio.com/api/stargate/guides/webhooks
- https://docs.montonio.com/api/stargate/guides/financing
- https://docs.montonio.com/api/stargate/guides/embedded-cards
- https://docs.montonio.com/api/stargate/guides/payment-links
- https://docs.montonio.com/api/stargate/widgets
- https://docs.montonio.com/api/stargate/reference
- https://docs.montonio.com/api/shipping-v2/overview
- https://docs.montonio.com/api/shipping-v2/guides/shipping-methods
- https://docs.montonio.com/api/shipping-v2/guides/shipments
- https://docs.montonio.com/api/shipping-v2/guides/webhooks
- https://docs.montonio.com/api/shipping-v2/guides/sandbox
- https://docs.montonio.com/api/shipping-v2/reference
- https://docs.montonio.com/api/shipping
- https://help.montonio.com/en/articles/174881-available-shipping-methods-and-countries-in-montonio
- https://help.montonio.com/en/articles/219852-shipping-with-montonio-special-prices
- https://help.montonio.com/en/articles/185095-unisend-by-montonio
- https://help.montonio.com/en/articles/27851-where-to-find-sandbox-api-keys
- https://help.montonio.com/en/articles/157815-how-to-test-card-payments-in-your-store
- https://www.montonio.com/pricing
- https://github.com/montonio/montonio-js
