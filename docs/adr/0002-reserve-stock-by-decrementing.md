# Reserve stock by decrementing it at checkout

Checkout reserves stock by decrementing the variant's stock column with a `stock >= quantity` guard in the transaction that creates the order, and puts it back on stock release; the `PAID` webhook no longer decrements. So the stock column always means available stock ("Laisva"), and the overselling race is settled at checkout instead of after the customer has paid. We rejected a separate reserved-quantity column and computing availability from pending orders, which make every stock read more complex for little gain at this shop's size.

## Consequences

- Each order has `stockReleasedAt`. Every release path (the `ABANDONED` webhook, checkout, the cleanup route) sets it with `updateMany` where it is null and the order isn't paid, and adds stock back only if that changed one row, in the same transaction. That is what stops stock from being returned twice or for a paid order.
- A payment that arrives after release must reserve again; if stock is gone, the order is paid but gets a review flag.
- The admin's "Rezervuota" is computed from pending orders for display only, and "Viso" (physical count) is Laisva + Rezervuota.
