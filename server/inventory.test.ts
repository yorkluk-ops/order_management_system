import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-inventory-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: { origin: "http://localhost:3000" },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("Inventory Management", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  let testShopId: number;
  let testShopId2: number;
  let testProductId: number;

  beforeAll(async () => {
    // Create test shops
    const shop1 = await caller.shops.create({
      name: `Test Shop ${Date.now()}`,
      sortOrder: 100,
    });
    testShopId = shop1.id;

    const shop2 = await caller.shops.create({
      name: `Test Shop 2 ${Date.now()}`,
      sortOrder: 101,
    });
    testShopId2 = shop2.id;

    // Create test product
    const product = await caller.products.create({
      sku: `TEST-INV-${Date.now()}`,
      name: "Test Inventory Product",
      color: "Blue",
      price: 100,
      stockHK: 0,
      stockCN: 0,
    });
    testProductId = product.id;
  });

  describe("Shop Inventory - adjust", () => {
    it("should adjust inventory and return new quantity", async () => {
      const result = await caller.inventory.adjust({
        productId: testProductId,
        shopId: testShopId,
        quantityChange: 10,
        notes: "Initial stock",
      });

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(10);
    });

    it("should allow negative adjustments", async () => {
      const result = await caller.inventory.adjust({
        productId: testProductId,
        shopId: testShopId,
        quantityChange: -3,
        notes: "Sold 3 units",
      });

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(7);
    });

    it("should allow inventory to go negative", async () => {
      const result = await caller.inventory.adjust({
        productId: testProductId,
        shopId: testShopId,
        quantityChange: -20,
        notes: "Oversold",
      });

      expect(result.success).toBe(true);
      expect(result.newQuantity).toBe(-13);
    });
  });

  describe("Shop Inventory - set", () => {
    it("should set inventory to specific value", async () => {
      const result = await caller.inventory.set({
        productId: testProductId,
        shopId: testShopId,
        quantity: 50,
        notes: "Reset stock",
      });

      expect(result.success).toBe(true);
    });

    it("should verify set quantity via byProduct query", async () => {
      const inventoryList = await caller.inventory.byProduct({
        productId: testProductId,
      });

      const shopEntry = inventoryList.find((i) => i.shopId === testShopId);
      expect(shopEntry).toBeDefined();
      expect(shopEntry!.quantity).toBe(50);
    });
  });

  describe("Shop Inventory - logs", () => {
    it("should return inventory logs", async () => {
      const logs = await caller.inventory.logs({
        productId: testProductId,
        shopId: testShopId,
        limit: 10,
      });

      expect(logs.length).toBeGreaterThan(0);
      // Should have manual change type
      expect(logs.some((l) => l.changeType === "manual")).toBe(true);
    });
  });

  describe("Purchase Orders", () => {
    let poId: number;
    let poNumber: string;

    it("should create a purchase order", async () => {
      const result = await caller.purchaseOrders.create({
        supplier: "Test Supplier",
        shopId: testShopId,
        orderDate: new Date().toISOString(),
        notes: "Test PO",
        items: [
          {
            productId: testProductId,
            sku: `TEST-INV-${testProductId}`,
            productName: "Test Inventory Product",
            color: "Blue",
            quantity: 20,
            unitCost: 50,
          },
        ],
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.poNumber).toMatch(/^PO\d{4}\d{4}$/);
      poId = result.id;
      poNumber = result.poNumber;
    });

    it("should list purchase orders", async () => {
      const result = await caller.purchaseOrders.list();
      expect(result.total).toBeGreaterThan(0);
      expect(result.orders.some((o) => o.id === poId)).toBe(true);
    });

    it("should get purchase order detail", async () => {
      const detail = await caller.purchaseOrders.get({ id: poId });
      expect(detail).not.toBeNull();
      expect(detail!.poNumber).toBe(poNumber);
      expect(detail!.items.length).toBe(1);
      expect(detail!.items[0].quantity).toBe(20);
    });

    it("should update status to ordered", async () => {
      const result = await caller.purchaseOrders.updateStatus({
        id: poId,
        status: "ordered",
      });
      expect(result.success).toBe(true);
    });

    it("should update status to received and auto-adjust inventory", async () => {
      // Get current inventory before receiving
      const beforeInventory = await caller.inventory.byProduct({
        productId: testProductId,
      });
      const beforeQty = beforeInventory.find((i) => i.shopId === testShopId)?.quantity || 0;

      const result = await caller.purchaseOrders.updateStatus({
        id: poId,
        status: "received",
      });
      expect(result.success).toBe(true);

      // Verify inventory increased
      const afterInventory = await caller.inventory.byProduct({
        productId: testProductId,
      });
      const afterQty = afterInventory.find((i) => i.shopId === testShopId)?.quantity || 0;
      expect(afterQty).toBe(beforeQty + 20);

      // Verify inventory log was created
      const logs = await caller.inventory.logs({
        productId: testProductId,
        shopId: testShopId,
        limit: 5,
      });
      expect(logs.some((l) => l.changeType === "purchase")).toBe(true);
    });

    it("should not delete received purchase order", async () => {
      await expect(caller.purchaseOrders.delete({ id: poId })).rejects.toThrow(
        "已收貨的採購單不可刪除"
      );
    });
  });

  describe("Stock Transfers", () => {
    let transferId: number;

    it("should create a stock transfer", async () => {
      // First ensure source shop has inventory
      await caller.inventory.set({
        productId: testProductId,
        shopId: testShopId,
        quantity: 100,
      });

      const result = await caller.stockTransfers.create({
        fromShopId: testShopId,
        toShopId: testShopId2,
        notes: "Test transfer",
        items: [
          {
            productId: testProductId,
            sku: `TEST-INV-${testProductId}`,
            productName: "Test Inventory Product",
            color: "Blue",
            quantity: 15,
          },
        ],
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.transferNumber).toMatch(/^TR\d{4}\d{4}$/);
      transferId = result.id;
    });

    it("should not allow same shop transfer", async () => {
      await expect(
        caller.stockTransfers.create({
          fromShopId: testShopId,
          toShopId: testShopId,
          items: [
            {
              productId: testProductId,
              sku: "TEST",
              productName: "Test",
              quantity: 1,
            },
          ],
        })
      ).rejects.toThrow("來源商鋪和目標商鋪不能相同");
    });

    it("should list stock transfers", async () => {
      const result = await caller.stockTransfers.list();
      expect(result.total).toBeGreaterThan(0);
    });

    it("should get transfer detail", async () => {
      const detail = await caller.stockTransfers.get({ id: transferId });
      expect(detail).not.toBeNull();
      expect(detail!.items.length).toBe(1);
      expect(detail!.items[0].quantity).toBe(15);
    });

    it("should confirm transfer and update both shop inventories", async () => {
      const beforeFrom = await caller.inventory.byProduct({ productId: testProductId });
      const fromQtyBefore = beforeFrom.find((i) => i.shopId === testShopId)?.quantity || 0;
      const toQtyBefore = beforeFrom.find((i) => i.shopId === testShopId2)?.quantity || 0;

      const result = await caller.stockTransfers.confirm({ id: transferId });
      expect(result.success).toBe(true);

      const afterInventory = await caller.inventory.byProduct({ productId: testProductId });
      const fromQtyAfter = afterInventory.find((i) => i.shopId === testShopId)?.quantity || 0;
      const toQtyAfter = afterInventory.find((i) => i.shopId === testShopId2)?.quantity || 0;

      expect(fromQtyAfter).toBe(fromQtyBefore - 15);
      expect(toQtyAfter).toBe(toQtyBefore + 15);

      // Verify logs
      const logs = await caller.inventory.logs({
        productId: testProductId,
        limit: 10,
      });
      expect(logs.some((l) => l.changeType === "transfer_out")).toBe(true);
      expect(logs.some((l) => l.changeType === "transfer_in")).toBe(true);
    });

    it("should not confirm already completed transfer", async () => {
      await expect(
        caller.stockTransfers.confirm({ id: transferId })
      ).rejects.toThrow("只有待確認的調撥單可以執行");
    });
  });
});
