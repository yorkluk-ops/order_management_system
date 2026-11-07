import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("./db", () => ({
  getShopByName: vi.fn(),
  getShopById: vi.fn(),
  getAllShops: vi.fn(),
  createShop: vi.fn(),
  getProductBySku: vi.fn(),
  getProductById: vi.fn(),
  createOrder: vi.fn(),
  addOrderProducts: vi.fn(),
  updateProductStockBySku: vi.fn(),
  updateProductStock: vi.fn(),
  adjustShopInventory: vi.fn(),
  createInventoryLog: vi.fn(),
  getShopInventoryItem: vi.fn(),
  getOrderById: vi.fn(),
  getOrderProducts: vi.fn(),
  updateOrderStatus: vi.fn(),
  updateOrder: vi.fn(),
  getExternalOrderImport: vi.fn(),
  claimExternalOrderImport: vi.fn(),
  completeExternalOrderImport: vi.fn(),
  releaseExternalOrderImport: vi.fn(),
  isDuplicateKeyError: (error: unknown) =>
    Boolean(error && typeof error === "object" && (error as { code?: string }).code === "ER_DUP_ENTRY"),
}));

import {
  addOrderProducts,
  adjustShopInventory,
  claimExternalOrderImport,
  completeExternalOrderImport,
  createOrder,
  createShop,
  getAllShops,
  getExternalOrderImport,
  getOrderById,
  getOrderProducts,
  getProductBySku,
  getProductById,
  getShopById,
  getShopByName,
  getShopInventoryItem,
  releaseExternalOrderImport,
  updateOrder,
  updateOrderStatus,
  updateProductStockBySku,
} from "./db";
import { ULTRON_SHOP_NAME } from "./orderFulfillment";
import { handleOrderImport, importExternalOrder } from "./orderImport";

const readyGo = { id: 3, name: "ReadyGo HK", isActive: "yes" as const };
const ultron = { id: 9, name: ULTRON_SHOP_NAME, isActive: "yes" as const };
const product = {
  id: 9,
  sku: "SBP-WGY-INT",
  name: "Shnuggle bath",
  color: "Grey",
  price: "499.00",
  isActive: "yes" as const,
  isGift: "no" as const,
};
const giftProduct = {
  id: 10,
  sku: "GIFT-RIBBON",
  name: "Ribbon",
  color: null,
  price: "0",
  isActive: "yes" as const,
  isGift: "yes" as const,
};

const sampleOrder = {
  platform: "shopline",
  externalOrderId: "SL-1001",
  customerName: "Ada Chan",
  customerPhone: "91234567",
  deliveryAddress: "1 Queen's Road, Central",
  paid: true,
  items: [{ sku: "SBP-WGY-INT", quantity: 2, unitPrice: 499 }],
};

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    orderNumber: "26EGB0008",
    customerName: "Ada Chan",
    customerPhone: "91234567",
    customerEmail: null,
    shopName: "ReadyGo HK",
    packageId: 1,
    packageName: "其他｜單件產品購買",
    packageVariant: null,
    orderAmount: "998",
    commission: "0",
    deliveryAddress: "1 Queen's Road, Central",
    deliveryDate: null,
    deliveryTimeSlot: null,
    trackingNumber: null,
    status: "pending",
    paymentStatus: "paid",
    paidAmount: "998.00",
    customerId: null,
    notes: "外部訂單 shopline:SL-1001",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    ...overrides,
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OMS_IMPORT_API_KEY = "test-import-key";

  vi.mocked(getAllShops).mockResolvedValue([]);
  vi.mocked(getShopByName).mockImplementation(async (name: string) => {
    if (name === readyGo.name) return readyGo as never;
    if (name === ultron.name) return ultron as never;
    return undefined;
  });
  vi.mocked(getProductBySku).mockImplementation(async (sku: string) => {
    if (sku === product.sku) return product as never;
    if (sku === giftProduct.sku) return giftProduct as never;
    return undefined;
  });
  vi.mocked(getProductById).mockImplementation(async (id: number) => {
    if (id === product.id) return product as never;
    if (id === giftProduct.id) return giftProduct as never;
    return undefined;
  });
  vi.mocked(createOrder).mockResolvedValue({ id: 55, orderNumber: "26EGB0008" });
  vi.mocked(addOrderProducts).mockResolvedValue(undefined as never);
  vi.mocked(updateProductStockBySku).mockResolvedValue(undefined as never);
  vi.mocked(adjustShopInventory).mockResolvedValue(8);
  vi.mocked(getShopInventoryItem).mockResolvedValue({ id: 1, productId: 9, shopId: 9, quantity: 20 } as never);
  vi.mocked(getOrderProducts).mockResolvedValue([
    { sku: product.sku, productName: product.name, quantity: 2, isGift: "no" },
  ] as never);
  vi.mocked(updateOrder).mockResolvedValue(undefined as never);
  vi.mocked(updateOrderStatus).mockImplementation(async (_id: number, status: string) => {
    currentStatus = status;
  });
  vi.mocked(getExternalOrderImport).mockResolvedValue(undefined);
  vi.mocked(claimExternalOrderImport).mockResolvedValue({ outcome: "claimed", id: 10 });
  vi.mocked(completeExternalOrderImport).mockResolvedValue(undefined as never);
  vi.mocked(releaseExternalOrderImport).mockResolvedValue(undefined as never);

  currentStatus = "pending";
  vi.mocked(getOrderById).mockImplementation(async () => orderRow({
    status: currentStatus,
    shopName: lastShopName,
  }) as never);
});

let currentStatus = "pending";
let lastShopName = "ReadyGo HK";

describe("order import", () => {
  it("creates an OMS order once and deducts shop plus Hong Kong stock", async () => {
    const created = await importExternalOrder(sampleOrder);

    expect(created.ok).toBe(true);
    expect(created.idempotent).toBe(false);
    expect(created.code).toBe("CREATED");
    expect(created.order.id).toBe(55);
    expect(created.order.orderNumber).toBe("26EGB0008");
    expect(created.order.shopName).toBe("ReadyGo HK");
    expect(created.order.paymentStatus).toBe("paid");

    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({
      shopName: "ReadyGo HK",
      customerName: "Ada Chan",
      orderAmount: "998",
      status: "pending",
    }));
    expect(updateProductStockBySku).toHaveBeenCalledWith("SBP-WGY-INT", -2);
    expect(adjustShopInventory).toHaveBeenCalledWith(9, readyGo.id, -2);
    expect(completeExternalOrderImport).toHaveBeenCalledWith(10, 55);
    expect(releaseExternalOrderImport).not.toHaveBeenCalled();

    vi.mocked(getExternalOrderImport).mockResolvedValue({
      id: 10,
      platform: "shopline",
      externalOrderId: "SL-1001",
      shopName: "ReadyGo HK",
      orderId: 55,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const replay = await importExternalOrder(sampleOrder);

    expect(replay.idempotent).toBe(true);
    expect(replay.code).toBe("ALREADY_IMPORTED");
    expect(replay.order.id).toBe(55);
    expect(replay.order.orderNumber).toBe("26EGB0008");
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(updateProductStockBySku).toHaveBeenCalledTimes(1);
    expect(adjustShopInventory).toHaveBeenCalledTimes(1);
    expect(claimExternalOrderImport).toHaveBeenCalledTimes(1);
  });

  it("rejects a second in-flight import without deducting again", async () => {
    vi.mocked(getExternalOrderImport).mockResolvedValue({
      id: 10,
      platform: "shopline",
      externalOrderId: "SL-1001",
      shopName: "ReadyGo HK",
      orderId: null,
      status: "processing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(importExternalOrder(sampleOrder)).rejects.toMatchObject({
      code: "IMPORT_IN_PROGRESS",
      httpStatus: 409,
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(adjustShopInventory).not.toHaveBeenCalled();
  });

  it("rejects unknown SKUs before creating an order", async () => {
    await expect(importExternalOrder({
      ...sampleOrder,
      externalOrderId: "SL-missing",
      items: [{ sku: "NO-SUCH-SKU", quantity: 1, unitPrice: 10 }],
    })).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND",
      httpStatus: 422,
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(claimExternalOrderImport).not.toHaveBeenCalled();
  });

  it("rejects delivering when the Ultron warehouse is short and does not create the order", async () => {
    vi.mocked(getShopInventoryItem).mockResolvedValue({ quantity: 0 } as never);

    await expect(importExternalOrder({
      ...sampleOrder,
      externalOrderId: "SL-ship",
      status: "shipped",
    })).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
      httpStatus: 409,
    });

    expect(createOrder).not.toHaveBeenCalled();
    expect(updateProductStockBySku).not.toHaveBeenCalled();
    expect(adjustShopInventory).not.toHaveBeenCalled();
    expect(claimExternalOrderImport).not.toHaveBeenCalled();
  });

  it("deducts the Ultron warehouse only for non-gift lines when status is delivering", async () => {
    vi.mocked(getOrderProducts).mockResolvedValue([
      { sku: product.sku, productName: product.name, quantity: 2, isGift: "no" },
      { sku: giftProduct.sku, productName: giftProduct.name, quantity: 1, isGift: "yes" },
    ] as never);

    const created = await importExternalOrder({
      ...sampleOrder,
      externalOrderId: "SL-deliver",
      status: "delivering",
      items: [
        { sku: product.sku, quantity: 2, unitPrice: 499 },
        { sku: giftProduct.sku, quantity: 1, unitPrice: 0, isGift: true },
      ],
    });

    expect(created.order.status).toBe("delivering");
    expect(updateProductStockBySku).toHaveBeenCalledWith(product.sku, -2);
    expect(updateProductStockBySku).toHaveBeenCalledWith(giftProduct.sku, -1);
    expect(adjustShopInventory).toHaveBeenCalledWith(product.id, readyGo.id, -2);
    expect(adjustShopInventory).toHaveBeenCalledWith(giftProduct.id, readyGo.id, -1);
    expect(adjustShopInventory).toHaveBeenCalledWith(product.id, ultron.id, -2);
    expect(adjustShopInventory).not.toHaveBeenCalledWith(giftProduct.id, ultron.id, -1);
  });

  it("maps platforms onto shops by name and creates a shop that is missing", async () => {
    lastShopName = "奧創數碼";
    let boutirCreated = false;
    vi.mocked(getShopByName).mockImplementation(async (name: string) => {
      if (name === ultron.name) return ultron as never;
      if (name === "奧創數碼" && boutirCreated) return { id: 12, name: "奧創數碼", isActive: "yes" } as never;
      return undefined;
    });
    vi.mocked(createShop).mockImplementation(async () => {
      boutirCreated = true;
      return 12;
    });
    vi.mocked(getShopById).mockResolvedValue({ id: 12, name: "奧創數碼", isActive: "yes" } as never);

    const created = await importExternalOrder({
      platform: "Boutir",
      externalOrderId: "BT-9",
      customerName: "Wholesale Co",
      items: [{ sku: product.sku, quantity: 1, price: 100 }],
    });

    expect(created.order.shopName).toBe("奧創數碼");
    expect(createShop).toHaveBeenCalledWith(expect.objectContaining({ name: "奧創數碼" }));
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ shopName: "奧創數碼" }));
    expect(adjustShopInventory).toHaveBeenCalledWith(product.id, 12, -1);
    lastShopName = "ReadyGo HK";
  });

  it("keeps Wix UPANG and Poled as distinct shops and requires a hint", async () => {
    await expect(importExternalOrder({
      platform: "wix",
      externalOrderId: "WX-1",
      customerName: "Pat",
      items: [{ sku: product.sku, quantity: 1 }],
    })).rejects.toMatchObject({ code: "SHOP_REQUIRED" });

    vi.mocked(createShop).mockResolvedValue(8);
    vi.mocked(getShopById).mockResolvedValue({ id: 8, name: "Poled HK", isActive: "yes" } as never);
    lastShopName = "Poled HK";

    const created = await importExternalOrder({
      platform: "wix",
      externalOrderId: "WX-2",
      shopKey: "poled",
      customerName: "Pat",
      items: [{ productId: product.id, quantity: 1, unitPrice: 10 }],
    });

    expect(created.order.shopName).toBe("Poled HK");
    expect(createShop).toHaveBeenCalledWith(expect.objectContaining({ name: "Poled HK" }));
    lastShopName = "ReadyGo HK";
  });

  it("refuses to use the Ultron warehouse as the selling shop", async () => {
    await expect(importExternalOrder({
      ...sampleOrder,
      externalOrderId: "SL-warehouse",
      shopName: ULTRON_SHOP_NAME,
    })).rejects.toMatchObject({ code: "SHOP_CONFLICT" });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("maps HKTVMALL and Shopify defaults without numeric shop ids", async () => {
    vi.mocked(getShopByName).mockResolvedValue(undefined);
    vi.mocked(createShop).mockImplementation(async (data: { name: string }) => {
      return data.name === "Ready Go HKTVMALL" ? 21 : 22;
    });
    vi.mocked(getShopById).mockImplementation(async (id: number) => ({
      id,
      name: id === 21 ? "Ready Go HKTVMALL" : "Shnuggle",
      isActive: "yes",
    }) as never);

    lastShopName = "Ready Go HKTVMALL";
    const hktv = await importExternalOrder({
      platform: "hktvmall",
      externalOrderId: "HK-1",
      customerName: "Mall",
      items: [{ sku: product.sku, qty: 1, unitPrice: 10 }],
    });
    expect(hktv.order.shopName).toBe("Ready Go HKTVMALL");

    lastShopName = "Shnuggle";
    vi.mocked(getExternalOrderImport).mockResolvedValue(undefined);
    const shopify = await importExternalOrder({
      source: "shopify",
      platformOrderId: "1009",
      customerName: "Shopify",
      lineItems: [{ sku: product.sku, quantity: 1, unitPrice: 10 }],
    });
    expect(shopify.order.shopName).toBe("Shnuggle");
    expect(shopify.order.externalOrderId).toBe("1009");
    lastShopName = "ReadyGo HK";
  });
});

describe("POST /api/import/orders", () => {
  it("rejects missing and wrong keys", async () => {
    delete process.env.OMS_IMPORT_API_KEY;
    const unconfigured = mockRes();
    await handleOrderImport({ headers: {}, body: sampleOrder } as Request, unconfigured as unknown as Response);
    expect(unconfigured.statusCode).toBe(503);
    expect(unconfigured.body).toMatchObject({ code: "API_KEY_NOT_CONFIGURED" });

    process.env.OMS_IMPORT_API_KEY = "test-import-key";
    const denied = mockRes();
    await handleOrderImport(
      { headers: { authorization: "Bearer wrong" }, body: sampleOrder } as Request,
      denied as unknown as Response,
    );
    expect(denied.statusCode).toBe(401);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("accepts a bearer token, then treats the identical call as idempotent", async () => {
    const first = mockRes();
    await handleOrderImport(
      { headers: { authorization: "Bearer test-import-key" }, body: sampleOrder } as Request,
      first as unknown as Response,
    );
    expect(first.statusCode).toBe(201);
    expect(first.body).toMatchObject({
      ok: true,
      code: "CREATED",
      order: { orderNumber: "26EGB0008", shopName: "ReadyGo HK" },
    });

    vi.mocked(getExternalOrderImport).mockResolvedValue({
      id: 10,
      platform: "shopline",
      externalOrderId: "SL-1001",
      shopName: "ReadyGo HK",
      orderId: 55,
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const second = mockRes();
    await handleOrderImport(
      {
        headers: { "x-api-key": "test-import-key" },
        body: sampleOrder,
      } as unknown as Request,
      second as unknown as Response,
    );
    expect(second.statusCode).toBe(200);
    expect(second.body).toMatchObject({
      ok: true,
      idempotent: true,
      code: "ALREADY_IMPORTED",
      order: { id: 55, orderNumber: "26EGB0008" },
    });
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("returns per-order results for a small batch", async () => {
    const res = mockRes();
    await handleOrderImport(
      {
        headers: { authorization: "Bearer test-import-key" },
        body: {
          orders: [
            sampleOrder,
            { ...sampleOrder, externalOrderId: "SL-bad", items: [{ sku: "MISSING", quantity: 1 }] },
          ],
        },
      } as Request,
      res as unknown as Response,
    );

    expect(res.statusCode).toBe(207);
    const body = res.body as { ok: boolean; results: { ok: boolean; code: string }[] };
    expect(body.ok).toBe(false);
    expect(body.results[0]).toMatchObject({ ok: true, code: "CREATED" });
    expect(body.results[1]).toMatchObject({ ok: false, code: "PRODUCT_NOT_FOUND" });
    expect(createOrder).toHaveBeenCalledTimes(1);
  });
});
