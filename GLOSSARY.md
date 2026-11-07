# Babystep

The admin and public API for the Babystep shop: catalog, stock, orders and checkout, used by the storefront in `../babystep-store`.

## Catalog

**Product**:
An item the shop sells, with its name, description, images and base price. It is bought through one of its variants.
_Avoid_: Item, article

**Option group**:
A named way a product can differ, such as Dydis, Spalva or Stilius, shown as chips or swatches.
_Avoid_: Attribute, property, option type

**Store-level group**:
An option group shared by all products and managed on the Savybės page, such as Dydis and Spalva.
_Avoid_: Global attribute, shared option

**Product group**:
An option group that belongs to one product only.
_Avoid_: Local attribute, custom option

**Option value**:
One choice within an option group, such as "0–6 mėn." or "Šalavijų".
_Avoid_: Option, attribute value, term

**Variant**:
One buyable combination of option values of a product, with its own stock and SKU.
_Avoid_: Variation, SKU, combination

**Default variant**:
The single variant of a product that has no option groups; customers never see it as a choice.
_Avoid_: Master variant, base variant

**Variant label**:
The display text of a variant's option values with their group names, such as "Dydis: 0–6 mėn. · Spalva: Šalavijų".
_Avoid_: Variant name, options string

**Archived**:
Withdrawn from sale by the owner and hidden from the storefront, but kept for past orders.
_Avoid_: Inactive, discontinued, deleted

**Sold out**:
A product or variant that is still for sale but has no available stock.
_Avoid_: Out of stock (in code names), unavailable

## Stock

**Available stock**:
The number of units of a variant that can still be bought, excluding reserved stock. Shown as "Laisva" in the admin.
_Avoid_: Stock, inventory, amount in stock

**Reserved stock**:
Units held for unpaid orders until they are paid or released. Shown as "Rezervuota" in the admin.
_Avoid_: Held stock, locked stock

**Reservation**:
The hold an unpaid order places on stock from checkout until payment or release.
_Avoid_: Lock, hold

**Stock release**:
Returning an unpaid order's reserved stock to available stock, after the payment is abandoned or the reservation expires.
_Avoid_: Unreserve, restock, rollback

## Orders

**Review flag**:
A mark on an order that needs the owner's manual attention, such as a payment that arrived after its stock was released.
_Avoid_: Alert, issue, problem order
