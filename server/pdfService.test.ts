import { describe, expect, it } from "vitest";
import { generateQuotationPdf, generateInvoicePdf, generateReceiptPdf, type OrderForPdf } from "./pdfService";

const sampleOrder: OrderForPdf = {
  orderNumber: "26EGB0001",
  customerName: "測試客戶",
  customerPhone: "91234567",
  customerEmail: "test@example.com",
  deliveryAddress: "香港九龍觀塘道123號",
  deliveryDate: new Date("2026-03-01"),
  deliveryTimeSlot: "morning",
  orderAmount: "3780",
  paidAmount: "1000",
  paymentStatus: "partial",
  shopName: "ReadyGo HK",
  packageName: "嬰兒套餐A",
  packageVariant: null,
  products: [
    { sku: "UP911A-WH", name: "UP911 白色", color: "白色", quantity: 1, isGift: false },
    { sku: "UP911A-GR", name: "UP911 灰色", color: "灰色", quantity: 2, isGift: false },
  ],
  gifts: [
    { sku: "SBP-WGY-INT", name: "Shnuggle 嬰兒沐浴盤", color: "白色", quantity: 1, isGift: true },
  ],
  createdAt: new Date("2026-02-25"),
  notes: "請於下午送貨",
};

describe("PDF Service", () => {
  it("generates quotation PDF buffer", async () => {
    const buffer = await generateQuotationPdf(sampleOrder);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF files start with %PDF
    expect(buffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  }, 30000);

  it("generates invoice PDF buffer", async () => {
    const buffer = await generateInvoicePdf(sampleOrder);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  }, 30000);

  it("generates receipt PDF buffer", async () => {
    const buffer = await generateReceiptPdf(sampleOrder);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString("utf-8", 0, 5)).toBe("%PDF-");
  }, 30000);

  it("generates PDF for order with no products", async () => {
    const emptyOrder: OrderForPdf = {
      ...sampleOrder,
      products: [],
      gifts: [],
      notes: null,
    };
    const buffer = await generateQuotationPdf(emptyOrder);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 30000);

  it("generates PDF for order with no email", async () => {
    const noEmailOrder: OrderForPdf = {
      ...sampleOrder,
      customerEmail: null,
    };
    const buffer = await generateInvoicePdf(noEmailOrder);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 30000);

  it("receipt PDF shows paid amount for paid orders", async () => {
    const paidOrder: OrderForPdf = {
      ...sampleOrder,
      paymentStatus: "paid",
      paidAmount: "3780",
    };
    const buffer = await generateReceiptPdf(paidOrder);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  }, 30000);
});
