# Order import API

External storefronts stay outside this OMS. A bot pushes orders into `POST /api/import/orders`. The handler creates the order with the same function the order screen uses, so the same stock rules apply:

- On create, Hong Kong product stock (`products.stockHK`) and the selling shop's `shopInventory` are deducted. Both may go negative, same as a manual order.
- Moving the order to **delivering** deducts the Ultron warehouse shop **奧創數碼有限公司** and is rejected when that warehouse is short. Gifts are not deducted from the warehouse.
- Cancelling is not accepted on this API. Cancel in the OMS after import.
- There is no Shopline, HKTVmall, Wix, Shopify, or Boutir client in this repo. This endpoint is the only write path for those orders.

Apply the `externalOrders` migration (`pnpm db:push` or your usual Drizzle migrate) before the first import. The table's unique `(platform, externalOrderId)` key is what makes retries safe.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `OMS_IMPORT_API_KEY` | yes | Bearer token for the import route. Read at request time. Do not commit a real value. |
| `DATABASE_URL` | yes | Existing MySQL / TiDB connection. |

If `OMS_IMPORT_API_KEY` is unset, the route returns **503** `API_KEY_NOT_CONFIGURED` and does not accept traffic.

Send the key as `Authorization: Bearer <key>` or `X-API-Key: <key>`.

## Shop mapping

Shops are matched by **name**, never by a hardcoded id. A missing shop is created.

| Platform | Default shop | Notes |
| --- | --- | --- |
| `shopline` | `ReadyGo HK` | Aliases: `Ready Go`, `ReadyGo HK` |
| `hktvmall` | `Ready Go HKTVMALL` | |
| `shopify` | `Shnuggle` | |
| `boutir` | `奧創數碼` | Retail / wholesale. This is **not** the warehouse. |
| `wix` | none | Pass `shopKey`: `upang` → `Upang HK`, or `poled` → `Poled HK`. |

`shopName` wins over `shopKey`. If that exact shop already exists (case-insensitive), it is reused. Otherwise a known alias is used, otherwise the name you sent is created.

Do not send shop name `奧創數碼有限公司`. That shop is the warehouse deducted on delivering. Using it as the selling shop would deduct the same bucket twice. Boutir retail stays `奧創數碼`. The API returns **400** `SHOP_CONFLICT` if the warehouse name is used as the selling shop.

## SKU mapping

Each line needs `sku` or `productId`.

- `sku` must match `products.sku` on an active product.
- `productId` must be `products.id`. If you also send `sku`, it must be that product's SKU.
- Unknown or inactive products return **422** `PRODUCT_NOT_FOUND` and nothing is deducted.
- `productName`, `color`, and `unitPrice` are optional. Omitted price uses the OMS product price. Omitted name uses the OMS product name.
- `isGift: true` still deducts shop and Hong Kong stock on create, and is skipped for the Ultron warehouse, same as the order screen.

## Request

`POST /api/import/orders`

One order:

```json
{
  "platform": "shopline",
  "externalOrderId": "SL-1001",
  "customerName": "Ada Chan",
  "customerPhone": "91234567",
  "customerEmail": "ada@example.com",
  "deliveryAddress": "1 Queen's Road, Central",
  "deliveryDate": "2026-11-08",
  "deliveryTimeSlot": "14:00-18:00",
  "status": "pending",
  "paid": true,
  "items": [
    { "sku": "SBP-WGY-INT", "quantity": 2, "unitPrice": 499 }
  ]
}
```

Aliases the bot can send: `source` for platform, `externalId` or `platformOrderId` for the external id, `lineItems` or `lines` for items, `qty` for quantity, `price` for unit price, `shop` / `shopHint`.

A batch of up to 20 orders uses `{ "orders": [ ... ] }`. Orders are applied one by one. A later failure does not roll back earlier successes. Replaying the batch is safe: successes come back as `ALREADY_IMPORTED`.

### Status

| Sent | OMS status | Stock |
| --- | --- | --- |
| omitted, `pending`, `new`, `open` | pending | shop + Hong Kong |
| `confirmed`, `processing` | confirmed | shop + Hong Kong |
| `delivering`, `shipped`, `fulfilled`, `shipping` | delivering | shop + Hong Kong, then Ultron warehouse |
| `completed`, `complete`, `done` | completed | shop + Hong Kong only. Ultron is **not** deducted unless the order actually passes through delivering. |
| `paid` | pending, payment marked paid | shop + Hong Kong |
| `cancelled` / `canceled` | rejected | none |

`paid: true` or `paymentStatus: "paid"` sets the order paid. `paidAmount` defaults to the order total. `paymentStatus: "partial"` requires `paidAmount`. `orderAmount` defaults to the sum of line price × quantity.

Phone and address default to `未提供` when the storefront does not have them.

## Responses

Created (**201**):

```json
{
  "ok": true,
  "idempotent": false,
  "code": "CREATED",
  "order": {
    "id": 55,
    "orderNumber": "26EGB0008",
    "shopName": "ReadyGo HK",
    "platform": "shopline",
    "externalOrderId": "SL-1001",
    "status": "pending",
    "paymentStatus": "paid",
    "paidAmount": "998.00"
  }
}
```

Same platform + external order id again (**200**). Stock is not moved. The body is the original OMS order, not a second one:

```json
{
  "ok": true,
  "idempotent": true,
  "code": "ALREADY_IMPORTED",
  "order": { "id": 55, "orderNumber": "26EGB0008" }
}
```

The idempotency key is `(platform, externalOrderId)` after the platform is lowercased. Changing the payload and retrying does not update the OMS order.

## Error codes

| HTTP | code | When |
| --- | --- | --- |
| 401 | `UNAUTHORIZED` | Missing or wrong API key |
| 503 | `API_KEY_NOT_CONFIGURED` | `OMS_IMPORT_API_KEY` is empty |
| 400 | `VALIDATION_ERROR` | Body shape, unknown status, cancelled, partial payment without amount |
| 400 | `SHOP_REQUIRED` | Wix (or an unknown platform) without `shopName` / `shopKey` |
| 400 | `SHOP_CONFLICT` | Selling shop is the Ultron warehouse |
| 400 | `BATCH_TOO_LARGE` | More than 20 orders |
| 409 | `INSUFFICIENT_STOCK` | Status is delivering and 奧創數碼有限公司 cannot cover the non-gift lines. No order is created. |
| 409 | `IMPORT_IN_PROGRESS` | Another request is currently importing this external order. Retry. |
| 409 | `IMPORTED_ORDER_MISSING` | The idempotency row exists but the OMS order was deleted |
| 422 | `PRODUCT_NOT_FOUND` | SKU or product id is not an active OMS product |
| 500 | `IMPORT_FAILED` | Unexpected failure |
| 207 | (batch) | The batch was accepted and at least one item failed. Inspect `results`. |

Insufficient warehouse stock uses the same check as the order screen (gifts ignored, missing product SKUs ignored only on the screen; import rejects unknown SKUs first). Shop and Hong Kong stock are still allowed to go negative on create.

## Checks

```bash
pnpm exec vitest run server/orderImport.test.ts
```

Against a running server and a real SKU:

```bash
OMS_BASE_URL=http://localhost:3000 OMS_IMPORT_API_KEY=... SMOKE_SKU=your-sku pnpm import:smoke
```
