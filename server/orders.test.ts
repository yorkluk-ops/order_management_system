import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { PACKAGE_DEFINITIONS, ORDER_STATUS } from "../shared/packages";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
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

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("packages.list", () => {
  it("returns packages from database (array format)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.packages.list();

    // Now packages come from database, so it returns an array
    expect(Array.isArray(result)).toBe(true);
    // If there are packages, check structure
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("code");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("price");
      expect(result[0]).toHaveProperty("commission");
    }
  });
});

describe("Package definitions validation", () => {
  it("all packages have valid structure", () => {
    PACKAGE_DEFINITIONS.forEach((pkg) => {
      expect(pkg.code).toBeTruthy();
      expect(pkg.name).toBeTruthy();
      // "OTHER" package can have price 0 for custom pricing
      if (pkg.code === "OTHER") {
        expect(pkg.price).toBeGreaterThanOrEqual(0);
      } else {
        expect(pkg.price).toBeGreaterThan(0);
      }
      expect(pkg.commission).toBeGreaterThanOrEqual(0);
    });
  });

  it("package codes are unique", () => {
    const codes = PACKAGE_DEFINITIONS.map((pkg) => pkg.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("variant codes are unique within each package", () => {
    PACKAGE_DEFINITIONS.forEach((pkg) => {
      if (pkg.variants) {
        const variantCodes = pkg.variants.map((v) => v.code);
        const uniqueVariantCodes = new Set(variantCodes);
        expect(uniqueVariantCodes.size).toBe(variantCodes.length);
      }
    });
  });

  it("all variant codes include parent package code prefix", () => {
    PACKAGE_DEFINITIONS.forEach((pkg) => {
      if (pkg.variants) {
        pkg.variants.forEach((variant) => {
          expect(variant.code.startsWith(pkg.code)).toBe(true);
        });
      }
    });
  });
});

describe("Order status constants", () => {
  it("ORDER_STATUS has all required statuses", () => {
    expect(ORDER_STATUS).toHaveProperty("pending");
    expect(ORDER_STATUS).toHaveProperty("confirmed");
    expect(ORDER_STATUS).toHaveProperty("delivering");
    expect(ORDER_STATUS).toHaveProperty("completed");
    expect(ORDER_STATUS).toHaveProperty("cancelled");
  });

  it("each status has label and color", () => {
    Object.values(ORDER_STATUS).forEach((status: any) => {
      expect(status).toHaveProperty("label");
      expect(status).toHaveProperty("color");
    });
  });
});
