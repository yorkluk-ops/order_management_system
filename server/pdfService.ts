import { jsPDF } from "jspdf";

// 訂單資料類型
export interface OrderForPdf {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryAddress: string;
  deliveryDate?: Date | null;
  deliveryTimeSlot?: string | null;
  orderAmount: string | number;
  paidAmount?: string | number;
  paymentStatus?: string;
  packageName: string;
  packageVariant?: string | null;
  products: Array<{
    sku: string;
    name: string;
    color?: string | null;
    quantity: number;
  }>;
  gifts: Array<{
    sku: string;
    name: string;
    color?: string | null;
    quantity: number;
  }>;
  createdAt: Date;
  notes?: string | null;
}

// 公司資訊
const companyInfo = {
  name: "Order Management System",
  address: "Hong Kong",
};

// 格式化日期
function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// 格式化金額
function formatAmount(amount: string | number): string {
  return `HK$${Number(amount).toLocaleString()}`;
}

// 付款狀態
function getPaymentStatusText(status?: string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "unpaid":
    default:
      return "Unpaid";
  }
}

// 手動繪製表格
function drawTable(
  doc: jsPDF,
  startY: number,
  headers: string[],
  data: string[][],
  colWidths: number[]
): number {
  const rowHeight = 8;
  const startX = 20;
  let y = startY;

  // 繪製表頭
  doc.setFillColor(240, 240, 240);
  doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  
  let x = startX;
  headers.forEach((header, i) => {
    doc.text(header, x + 2, y + 5.5);
    x += colWidths[i];
  });
  y += rowHeight;

  // 繪製資料行
  doc.setFont("helvetica", "normal");
  data.forEach((row) => {
    x = startX;
    row.forEach((cell, i) => {
      // 截斷過長的文字
      const maxWidth = colWidths[i] - 4;
      let text = cell;
      while (doc.getTextWidth(text) > maxWidth && text.length > 0) {
        text = text.slice(0, -1);
      }
      if (text !== cell) text += "...";
      doc.text(text, x + 2, y + 5.5);
      x += colWidths[i];
    });
    y += rowHeight;
  });

  // 繪製表格邊框
  doc.setDrawColor(200, 200, 200);
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableHeight = (data.length + 1) * rowHeight;
  doc.rect(startX, startY, tableWidth, tableHeight);
  
  // 繪製垂直線
  x = startX;
  colWidths.forEach((width) => {
    x += width;
    doc.line(x, startY, x, startY + tableHeight);
  });
  
  // 繪製水平線
  for (let i = 0; i <= data.length; i++) {
    doc.line(startX, startY + i * rowHeight, startX + tableWidth, startY + i * rowHeight);
  }

  return y + 5;
}

// 生成報價單 PDF
export async function generateQuotationPdf(order: OrderForPdf): Promise<Buffer> {
  const doc = new jsPDF();
  let y = 20;

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", 105, y, { align: "center" });
  y += 15;

  // Company Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(companyInfo.name, 20, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companyInfo.address, 20, y);
  y += 10;

  // Document Info
  doc.text(`Quotation No: ${order.orderNumber}`, 20, y);
  y += 6;
  doc.text(`Date: ${formatDate(order.createdAt)}`, 20, y);
  y += 10;

  // Line
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;

  // Customer Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Customer Information", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${order.customerName}`, 20, y);
  y += 6;
  doc.text(`Phone: ${order.customerPhone}`, 20, y);
  y += 6;
  if (order.customerEmail) {
    doc.text(`Email: ${order.customerEmail}`, 20, y);
    y += 6;
  }
  doc.text(`Address: ${order.deliveryAddress}`, 20, y);
  y += 10;

  // Package Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Package Information", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Package: ${order.packageName}`, 20, y);
  y += 6;
  if (order.packageVariant) {
    doc.text(`Variant: ${order.packageVariant}`, 20, y);
    y += 6;
  }
  y += 5;

  // Products Table
  if (order.products.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Product Details", 20, y);
    y += 5;

    const productData = order.products.map((p, i) => [
      (i + 1).toString(),
      p.sku,
      `${p.name}${p.color ? ` (${p.color})` : ""}`,
      p.quantity.toString(),
    ]);

    y = drawTable(doc, y, ["No.", "SKU", "Product Name", "Qty"], productData, [15, 40, 100, 20]);
  }

  // Gifts Table
  if (order.gifts.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Gift Items", 20, y);
    y += 5;

    const giftData = order.gifts.map((g, i) => [
      (i + 1).toString(),
      g.sku,
      `${g.name}${g.color ? ` (${g.color})` : ""}`,
      g.quantity.toString(),
    ]);

    y = drawTable(doc, y, ["No.", "SKU", "Gift Name", "Qty"], giftData, [15, 40, 100, 20]);
  }

  // Total
  y += 5;
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Amount: ${formatAmount(order.orderAmount)}`, 190, y, { align: "right" });

  return Buffer.from(doc.output("arraybuffer"));
}

// 生成發票 PDF
export async function generateInvoicePdf(order: OrderForPdf): Promise<Buffer> {
  const doc = new jsPDF();
  let y = 20;

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 105, y, { align: "center" });
  y += 15;

  // Company Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(companyInfo.name, 20, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companyInfo.address, 20, y);
  y += 10;

  // Document Info
  doc.text(`Invoice No: ${order.orderNumber}`, 20, y);
  y += 6;
  doc.text(`Date: ${formatDate(order.createdAt)}`, 20, y);
  y += 6;
  doc.text(`Payment Status: ${getPaymentStatusText(order.paymentStatus)}`, 20, y);
  y += 10;

  // Line
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;

  // Customer Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${order.customerName}`, 20, y);
  y += 6;
  doc.text(`Phone: ${order.customerPhone}`, 20, y);
  y += 6;
  if (order.customerEmail) {
    doc.text(`Email: ${order.customerEmail}`, 20, y);
    y += 6;
  }
  doc.text(`Address: ${order.deliveryAddress}`, 20, y);
  y += 10;

  // Package Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Package Information", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Package: ${order.packageName}`, 20, y);
  y += 6;
  if (order.packageVariant) {
    doc.text(`Variant: ${order.packageVariant}`, 20, y);
    y += 6;
  }
  y += 5;

  // Products Table
  if (order.products.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Product Details", 20, y);
    y += 5;

    const productData = order.products.map((p, i) => [
      (i + 1).toString(),
      p.sku,
      `${p.name}${p.color ? ` (${p.color})` : ""}`,
      p.quantity.toString(),
    ]);

    y = drawTable(doc, y, ["No.", "SKU", "Product Name", "Qty"], productData, [15, 40, 100, 20]);
  }

  // Gifts Table
  if (order.gifts.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Gift Items", 20, y);
    y += 5;

    const giftData = order.gifts.map((g, i) => [
      (i + 1).toString(),
      g.sku,
      `${g.name}${g.color ? ` (${g.color})` : ""}`,
      g.quantity.toString(),
    ]);

    y = drawTable(doc, y, ["No.", "SKU", "Gift Name", "Qty"], giftData, [15, 40, 100, 20]);
  }

  // Payment Summary
  y += 5;
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Total Amount: ${formatAmount(order.orderAmount)}`, 190, y, { align: "right" });
  y += 6;
  doc.text(`Paid Amount: ${formatAmount(order.paidAmount || 0)}`, 190, y, { align: "right" });
  y += 6;
  const balance = Number(order.orderAmount) - Number(order.paidAmount || 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Balance Due: ${formatAmount(balance)}`, 190, y, { align: "right" });

  return Buffer.from(doc.output("arraybuffer"));
}

// 生成收據 PDF
export async function generateReceiptPdf(order: OrderForPdf): Promise<Buffer> {
  const doc = new jsPDF();
  let y = 20;

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("RECEIPT", 105, y, { align: "center" });
  y += 15;

  // Company Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(companyInfo.name, 20, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(companyInfo.address, 20, y);
  y += 10;

  // Document Info
  doc.text(`Receipt No: ${order.orderNumber}`, 20, y);
  y += 6;
  doc.text(`Date: ${formatDate(order.createdAt)}`, 20, y);
  y += 10;

  // Line
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;

  // Customer Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Received From", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${order.customerName}`, 20, y);
  y += 6;
  doc.text(`Phone: ${order.customerPhone}`, 20, y);
  y += 6;
  if (order.customerEmail) {
    doc.text(`Email: ${order.customerEmail}`, 20, y);
    y += 6;
  }
  y += 5;

  // Package Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("For", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Package: ${order.packageName}`, 20, y);
  y += 6;
  if (order.packageVariant) {
    doc.text(`Variant: ${order.packageVariant}`, 20, y);
    y += 6;
  }
  y += 5;

  // Products Table
  if (order.products.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Product Details", 20, y);
    y += 5;

    const productData = order.products.map((p, i) => [
      (i + 1).toString(),
      p.sku,
      `${p.name}${p.color ? ` (${p.color})` : ""}`,
      p.quantity.toString(),
    ]);

    y = drawTable(doc, y, ["No.", "SKU", "Product Name", "Qty"], productData, [15, 40, 100, 20]);
  }

  // Gifts Table
  if (order.gifts.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Gift Items", 20, y);
    y += 5;

    const giftData = order.gifts.map((g, i) => [
      (i + 1).toString(),
      g.sku,
      `${g.name}${g.color ? ` (${g.color})` : ""}`,
      g.quantity.toString(),
    ]);

    y = drawTable(doc, y, ["No.", "SKU", "Gift Name", "Qty"], giftData, [15, 40, 100, 20]);
  }

  // Payment Summary
  y += 5;
  doc.setLineWidth(0.5);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Amount Received: ${formatAmount(order.paidAmount || order.orderAmount)}`, 190, y, { align: "right" });
  y += 15;

  // Thank you
  doc.setDrawColor(150, 150, 150);
  doc.setLineDashPattern([5, 5], 0);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Thank you for your purchase!", 105, y, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}
