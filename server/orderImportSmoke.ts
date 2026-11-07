/**
 * Live smoke for POST /api/import/orders.
 *
 *   OMS_BASE_URL=http://localhost:3000 \
 *   OMS_IMPORT_API_KEY=... \
 *   SMOKE_SKU=your-oms-sku \
 *   pnpm import:smoke
 *
 * Posts one order, then posts the same body again.
 * The first response must be CREATED. The second must be ALREADY_IMPORTED
 * with the same OMS order id (no second stock deduction).
 */
const baseUrl = process.env.OMS_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.OMS_IMPORT_API_KEY;
const sku = process.env.SMOKE_SKU;

function usage(): void {
  console.error(
    "Set OMS_BASE_URL, OMS_IMPORT_API_KEY, and SMOKE_SKU (an existing products.sku).\n" +
      "Unit coverage without a server: pnpm exec vitest run server/orderImport.test.ts",
  );
}

async function main(): Promise<void> {
  if (!baseUrl || !apiKey || !sku) {
    usage();
    process.exit(1);
  }

  const externalOrderId = `smoke-${Date.now()}`;
  const payload = {
    platform: "shopline",
    externalOrderId,
    customerName: "Import Smoke",
    customerPhone: "00000000",
    deliveryAddress: "Smoke test address",
    status: "pending",
    paymentStatus: "unpaid",
    items: [{ sku, quantity: 1, unitPrice: 1 }],
  };

  const post = async () => {
    const response = await fetch(`${baseUrl}/api/import/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as {
      ok?: boolean;
      code?: string;
      message?: string;
      order?: { id?: number; orderNumber?: string };
    };
    return { status: response.status, body };
  };

  const first = await post();
  if (first.status !== 201 || first.body.code !== "CREATED" || !first.body.order?.id) {
    console.error("Expected the first import to create one order.", first);
    process.exit(1);
  }

  const second = await post();
  if (
    second.status !== 200 ||
    second.body.code !== "ALREADY_IMPORTED" ||
    second.body.order?.id !== first.body.order.id
  ) {
    console.error("Expected the second import to be idempotent.", { first, second });
    process.exit(1);
  }

  console.log(
    `ok created ${first.body.order.orderNumber} (#${first.body.order.id}) ` +
      `and replayed ${externalOrderId} without a second order`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
