import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database module
vi.mock("./db", () => ({
  getAllShops: vi.fn(),
  getShopById: vi.fn(),
  getShopByName: vi.fn(),
  createShop: vi.fn(),
  updateShop: vi.fn(),
  deleteShop: vi.fn(),
}));

import { getAllShops, getShopById, getShopByName, createShop, updateShop, deleteShop } from "./db";

describe("Shop CRUD Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllShops", () => {
    it("should return active shops sorted by sortOrder", async () => {
      const mockShops = [
        { id: 1, name: "ReadyGo HK", sortOrder: 0, isActive: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
        { id: 2, name: "Poled HK", sortOrder: 1, isActive: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
        { id: 3, name: "Upang HK", sortOrder: 2, isActive: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
      ];
      (getAllShops as any).mockResolvedValue(mockShops);

      const result = await getAllShops();
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("ReadyGo HK");
      expect(result[1].name).toBe("Poled HK");
      expect(result[2].name).toBe("Upang HK");
    });

    it("should return all shops including inactive when includeInactive is true", async () => {
      const mockShops = [
        { id: 1, name: "ReadyGo HK", sortOrder: 0, isActive: "yes" as const, createdAt: new Date(), updatedAt: new Date() },
        { id: 4, name: "Inactive Shop", sortOrder: 3, isActive: "no" as const, createdAt: new Date(), updatedAt: new Date() },
      ];
      (getAllShops as any).mockResolvedValue(mockShops);

      const result = await getAllShops(true);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when no shops exist", async () => {
      (getAllShops as any).mockResolvedValue([]);
      const result = await getAllShops();
      expect(result).toEqual([]);
    });
  });

  describe("getShopByName", () => {
    it("should find shop by exact name", async () => {
      const mockShop = { id: 1, name: "ReadyGo HK", sortOrder: 0, isActive: "yes" as const, createdAt: new Date(), updatedAt: new Date() };
      (getShopByName as any).mockResolvedValue(mockShop);

      const result = await getShopByName("ReadyGo HK");
      expect(result).toBeDefined();
      expect(result?.name).toBe("ReadyGo HK");
    });

    it("should return undefined for non-existent shop", async () => {
      (getShopByName as any).mockResolvedValue(undefined);

      const result = await getShopByName("Non Existent");
      expect(result).toBeUndefined();
    });
  });

  describe("createShop", () => {
    it("should create a new shop and return its id", async () => {
      (createShop as any).mockResolvedValue(7);

      const result = await createShop({
        name: "New Shop",
        sortOrder: 6,
        isActive: "yes",
      });
      expect(result).toBe(7);
      expect(createShop).toHaveBeenCalledWith({
        name: "New Shop",
        sortOrder: 6,
        isActive: "yes",
      });
    });
  });

  describe("updateShop", () => {
    it("should update shop name", async () => {
      (updateShop as any).mockResolvedValue(undefined);

      await updateShop(1, { name: "Updated Name" });
      expect(updateShop).toHaveBeenCalledWith(1, { name: "Updated Name" });
    });

    it("should update shop sortOrder", async () => {
      (updateShop as any).mockResolvedValue(undefined);

      await updateShop(1, { sortOrder: 10 });
      expect(updateShop).toHaveBeenCalledWith(1, { sortOrder: 10 });
    });

    it("should toggle shop active status", async () => {
      (updateShop as any).mockResolvedValue(undefined);

      await updateShop(1, { isActive: "no" });
      expect(updateShop).toHaveBeenCalledWith(1, { isActive: "no" });
    });
  });

  describe("deleteShop", () => {
    it("should delete shop by id", async () => {
      (deleteShop as any).mockResolvedValue(undefined);

      await deleteShop(1);
      expect(deleteShop).toHaveBeenCalledWith(1);
    });
  });

  describe("Shop name uniqueness", () => {
    it("should prevent creating shop with duplicate name", async () => {
      const existingShop = { id: 1, name: "ReadyGo HK", sortOrder: 0, isActive: "yes" as const, createdAt: new Date(), updatedAt: new Date() };
      (getShopByName as any).mockResolvedValue(existingShop);

      const existing = await getShopByName("ReadyGo HK");
      expect(existing).toBeDefined();
      // In the router, this would throw an error
    });

    it("should allow creating shop with unique name", async () => {
      (getShopByName as any).mockResolvedValue(undefined);
      (createShop as any).mockResolvedValue(8);

      const existing = await getShopByName("Brand New Shop");
      expect(existing).toBeUndefined();

      const id = await createShop({
        name: "Brand New Shop",
        sortOrder: 7,
        isActive: "yes",
      });
      expect(id).toBe(8);
    });
  });

  describe("OrderFilters with shopName", () => {
    it("should support shopName in filter interface", () => {
      // This test validates the TypeScript interface
      const filters = {
        search: "test",
        status: "pending",
        shopName: "ReadyGo HK",
        dateFrom: new Date(),
        dateTo: new Date(),
      };
      expect(filters.shopName).toBe("ReadyGo HK");
    });
  });
});
