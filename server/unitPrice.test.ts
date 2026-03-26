import { describe, expect, it } from "vitest";
import { z } from "zod";

// Test the unitPrice schema validation logic (mirrors what's in routers.ts)
const orderProductSchema = z.object({
  productId: z.number(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0).optional(),
  isGift: z.boolean().default(false),
});

const orderCreateSchema = z.object({
  products: z.array(orderProductSchema).optional(),
  gifts: z.array(orderProductSchema).optional(),
  customAmount: z.number().optional(),
});

describe("Unit Price Schema Validation", () => {
  it("accepts products with unitPrice", () => {
    const input = {
      products: [
        { productId: 1, quantity: 2, unitPrice: 2380, isGift: false },
        { productId: 2, quantity: 1, unitPrice: 299, isGift: false },
      ],
    };
    const result = orderCreateSchema.parse(input);
    expect(result.products).toHaveLength(2);
    expect(result.products![0].unitPrice).toBe(2380);
    expect(result.products![1].unitPrice).toBe(299);
  });

  it("accepts products without unitPrice (backward compatibility)", () => {
    const input = {
      products: [
        { productId: 1, quantity: 2, isGift: false },
      ],
    };
    const result = orderCreateSchema.parse(input);
    expect(result.products).toHaveLength(1);
    expect(result.products![0].unitPrice).toBeUndefined();
  });

  it("rejects negative unitPrice", () => {
    const input = {
      products: [
        { productId: 1, quantity: 1, unitPrice: -100, isGift: false },
      ],
    };
    expect(() => orderCreateSchema.parse(input)).toThrow();
  });

  it("accepts unitPrice of 0 (free products)", () => {
    const input = {
      products: [
        { productId: 1, quantity: 1, unitPrice: 0, isGift: false },
      ],
    };
    const result = orderCreateSchema.parse(input);
    expect(result.products![0].unitPrice).toBe(0);
  });
});

describe("Unit Price Calculation Logic", () => {
  it("calculates total from products with unit prices", () => {
    const products = [
      { unitPrice: 2380, quantity: 1 },
      { unitPrice: 299, quantity: 2 },
    ];
    const total = products.reduce((sum, p) => sum + (p.unitPrice || 0) * p.quantity, 0);
    expect(total).toBe(2978); // 2380*1 + 299*2
  });

  it("handles mixed products (some with price, some without)", () => {
    const products = [
      { unitPrice: 2380, quantity: 1 },
      { unitPrice: 0, quantity: 2 },
    ];
    const total = products.reduce((sum, p) => sum + (p.unitPrice || 0) * p.quantity, 0);
    expect(total).toBe(2380);
  });

  it("handles all products without prices", () => {
    const products = [
      { unitPrice: 0, quantity: 1 },
      { unitPrice: 0, quantity: 2 },
    ];
    const total = products.reduce((sum, p) => sum + (p.unitPrice || 0) * p.quantity, 0);
    expect(total).toBe(0);
  });

  it("customAmount overrides calculated total when provided", () => {
    const products = [
      { unitPrice: 2380, quantity: 1 },
    ];
    const calculatedTotal = products.reduce((sum, p) => sum + (p.unitPrice || 0) * p.quantity, 0);
    const customAmount = 2000;
    
    // When customAmount is provided, it should take priority
    const finalAmount = customAmount > 0 ? customAmount : calculatedTotal;
    expect(finalAmount).toBe(2000);
  });

  it("uses calculated total when customAmount is 0 or not provided", () => {
    const products = [
      { unitPrice: 2380, quantity: 1 },
      { unitPrice: 299, quantity: 2 },
    ];
    const calculatedTotal = products.reduce((sum, p) => sum + (p.unitPrice || 0) * p.quantity, 0);
    const customAmount = 0;
    
    const finalAmount = customAmount > 0 ? customAmount : calculatedTotal;
    expect(finalAmount).toBe(2978);
  });
});

describe("Unit Price Display Logic", () => {
  it("detects when products have unit prices", () => {
    const products = [
      { unitPrice: 2380, quantity: 1 },
      { unitPrice: 299, quantity: 2 },
    ];
    const hasUnitPrice = products.some(p => (p.unitPrice || 0) > 0);
    expect(hasUnitPrice).toBe(true);
  });

  it("detects when no products have unit prices", () => {
    const products = [
      { unitPrice: 0, quantity: 1 },
      { unitPrice: undefined as any, quantity: 2 },
    ];
    const hasUnitPrice = products.some(p => (p.unitPrice || 0) > 0);
    expect(hasUnitPrice).toBe(false);
  });

  it("formats currency correctly", () => {
    const formatCurrency = (value: number): string => {
      return `HK$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };
    expect(formatCurrency(2380)).toBe("HK$2,380");
    expect(formatCurrency(299)).toBe("HK$299");
    expect(formatCurrency(0)).toBe("HK$0");
  });
});
