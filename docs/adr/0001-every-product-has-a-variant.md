# Every product has at least one variant

Stock, SKU and price overrides live only on `ProductVariant`; a product without option groups has exactly one default variant with no option values, and `Product` has no stock field. We chose this over keeping stock on `Product` for simple products and on variants for the rest, because reservation, stock release, the payment webhook, the catalog's in-stock filter and order items would otherwise each need two code paths. The public API hides the default variant, so the storefront and admins still see a plain product, and a checkout line item without `variantId` means "the product's only variant".

## Consequences

- Every order item points at a variant, and per-variant price history (Omnibus) covers simple products for free.
- Removing all option groups from a product replaces its variants with a new default variant.
