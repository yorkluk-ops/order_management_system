import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-shop-pdf-user",
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

describe("Shop Phone & Address Fields", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  let shopId: number;
  const uniqueName = `TestShopPA_${Date.now()}`;

  it("should create a shop with phone and address", async () => {
    const result = await caller.shops.create({
      name: uniqueName,
      phone: "+852 1234 5678",
      address: "香港九龍觀塘海濱道177號",
      sortOrder: 999,
    });
    expect(result.id).toBeDefined();
    shopId = result.id;
  });

  it("should list shops and include phone/address fields", async () => {
    const shops = await caller.shops.listAll();
    const shop = shops.find((s) => s.id === shopId);
    expect(shop).toBeDefined();
    expect(shop!.phone).toBe("+852 1234 5678");
    expect(shop!.address).toBe("香港九龍觀塘海濱道177號");
  });

  it("should update shop phone and address", async () => {
    await caller.shops.update({
      id: shopId,
      phone: "+852 9999 8888",
      address: "新地址：香港中環皇后大道中1號",
    });

    const shops = await caller.shops.listAll();
    const shop = shops.find((s) => s.id === shopId);
    expect(shop!.phone).toBe("+852 9999 8888");
    expect(shop!.address).toBe("新地址：香港中環皇后大道中1號");
  });

  it("should create a shop without phone/address (optional fields)", async () => {
    const result = await caller.shops.create({
      name: `TestShopNoPA_${Date.now()}`,
      sortOrder: 998,
    });
    expect(result.id).toBeDefined();

    const shops = await caller.shops.listAll();
    const shop = shops.find((s) => s.id === result.id);
    expect(shop!.phone).toBeNull();
    expect(shop!.address).toBeNull();

    // Cleanup
    await caller.shops.delete({ id: result.id });
  });

  // Cleanup at the end
  it("should clean up test shop", async () => {
    await caller.shops.delete({ id: shopId });
  });
});

describe("Stock Transfer PDF Generation", () => {
  const { ctx } = createAuthContext();
  const caller = appRouter.createCaller(ctx);

  let fromShopId: number;
  let toShopId: number;
  let productId: number;
  let transferId: number;

  beforeAll(async () => {
    // Create test shops with phone/address
    const fromShop = await caller.shops.create({
      name: `FromShopPDF_${Date.now()}`,
      phone: "+852 1111 2222",
      address: "觀塘海濱道177號海裕工業中心",
      sortOrder: 990,
    });
    fromShopId = fromShop.id;

    const toShop = await caller.shops.create({
      name: `ToShopPDF_${Date.now()}`,
      phone: "+852 3333 4444",
      address: "旺角彌敦道688號",
      sortOrder: 991,
    });
    toShopId = toShop.id;

    // Create test product
    const product = await caller.products.create({
      sku: `PDFTEST-${Date.now()}`,
      name: "PDF測試產品",
      color: "白色",
      price: 100,
      stockHK: 50,
    });
    productId = product.id;

    // Create a stock transfer
    const transfer = await caller.stockTransfers.create({
      fromShopId,
      toShopId,
      notes: "PDF生成測試調撥單",
      items: [
        {
          productId,
          sku: `PDFTEST-${Date.now()}`,
          productName: "PDF測試產品",
          color: "白色",
          quantity: 5,
        },
      ],
    });
    transferId = transfer.id;
  });

  it("should generate a PDF for a stock transfer", async () => {
    const result = await caller.stockTransfers.generatePdf({ id: transferId });

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.data.length).toBeGreaterThan(100); // Base64 encoded PDF should be substantial
    expect(result.filename).toContain("調撥單_");
    expect(result.filename.endsWith(".pdf")).toBe(true);
    expect(result.contentType).toBe("application/pdf");

    // Verify it's valid base64
    const decoded = Buffer.from(result.data, "base64");
    expect(decoded.length).toBeGreaterThan(0);

    // PDF files start with %PDF
    const pdfHeader = decoded.subarray(0, 5).toString("ascii");
    expect(pdfHeader).toBe("%PDF-");
  });

  it("should throw error for non-existent transfer", async () => {
    await expect(
      caller.stockTransfers.generatePdf({ id: 999999 })
    ).rejects.toThrow("調撥單不存在");
  });

  // Cleanup
  it("should clean up test data", async () => {
    await caller.stockTransfers.cancel({ id: transferId });
    await caller.products.delete({ id: productId });
    await caller.shops.delete({ id: fromShopId });
    await caller.shops.delete({ id: toShopId });
  });
});
