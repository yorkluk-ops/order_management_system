import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getAllProducts: vi.fn(),
    getProductById: vi.fn(),
    getProductBySku: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
  };
});

import {
  getAllProducts,
  getProductById,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
} from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("products router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("products.list", () => {
    it("returns all products", async () => {
      const mockProducts = [
        { id: 1, sku: "EUFY-E20", name: "EUFY E20", color: "黑色", price: "2488", isActive: "yes", createdAt: new Date(), updatedAt: new Date() },
        { id: 2, sku: "LOLIPOP-WHT", name: "LOLIPOP 監視器", color: "奶白色", price: "888", isActive: "yes", createdAt: new Date(), updatedAt: new Date() },
      ];
      vi.mocked(getAllProducts).mockResolvedValue(mockProducts as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.list();

      expect(result).toEqual(mockProducts);
      expect(getAllProducts).toHaveBeenCalled();
    });
  });

  describe("products.get", () => {
    it("returns a product by id", async () => {
      const mockProduct = { id: 1, sku: "EUFY-E20", name: "EUFY E20", color: "黑色", price: "2488", isActive: "yes", createdAt: new Date(), updatedAt: new Date() };
      vi.mocked(getProductById).mockResolvedValue(mockProduct as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.get({ id: 1 });

      expect(result).toEqual(mockProduct);
      expect(getProductById).toHaveBeenCalledWith(1);
    });
  });

  describe("products.create", () => {
    it("creates a new product", async () => {
      vi.mocked(getProductBySku).mockResolvedValue(undefined);
      vi.mocked(createProduct).mockResolvedValue(1);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.create({
        sku: "NEW-PRODUCT",
        name: "New Product",
        color: "白色",
        price: 1000,
      });

      expect(result).toEqual({ id: 1, sku: "NEW-PRODUCT" });
      expect(getProductBySku).toHaveBeenCalledWith("NEW-PRODUCT");
      expect(createProduct).toHaveBeenCalled();
    });

    it("throws error if SKU already exists", async () => {
      const existingProduct = { id: 1, sku: "EXISTING", name: "Existing", color: null, price: "0", isActive: "yes", createdAt: new Date(), updatedAt: new Date() };
      vi.mocked(getProductBySku).mockResolvedValue(existingProduct as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.products.create({
          sku: "EXISTING",
          name: "New Product",
        })
      ).rejects.toThrow("SKU 已存在");
    });
  });

  describe("products.update", () => {
    it("updates an existing product", async () => {
      vi.mocked(getProductBySku).mockResolvedValue(undefined);
      vi.mocked(updateProduct).mockResolvedValue();

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.update({
        id: 1,
        name: "Updated Name",
        color: "新顏色",
      });

      expect(result).toEqual({ success: true });
      expect(updateProduct).toHaveBeenCalled();
    });
  });

  describe("products.delete", () => {
    it("deletes a product", async () => {
      vi.mocked(deleteProduct).mockResolvedValue();

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.products.delete({ id: 1 });

      expect(result).toEqual({ success: true });
      expect(deleteProduct).toHaveBeenCalledWith(1);
    });
  });
});

describe("date format YYYYMMDD", () => {
  it("formats date correctly", () => {
    // Test the date formatting function logic
    const formatDateYYYYMMDD = (date: Date): string => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };

    expect(formatDateYYYYMMDD(new Date(2026, 4, 1))).toBe("20260501");
    expect(formatDateYYYYMMDD(new Date(2026, 0, 25))).toBe("20260125");
    expect(formatDateYYYYMMDD(new Date(2026, 11, 31))).toBe("20261231");
  });
});
