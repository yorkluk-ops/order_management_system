import PDFDocument from "pdfkit";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const FONT_CDN_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663035885409/jMRCeFnSdEfaYMvUXfCyak/NotoSansTC_4cb240ba.ttf";
const FONT_CACHE_PATH = path.join("/tmp", "NotoSansTC.ttf");
const LOGO_CDN_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663035885409/jbMQqpbKgBQzaPKM.png";
const LOGO_CACHE_PATH = path.join("/tmp", "company_logo.png");

export interface OrderForPdf {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  deliveryDate: Date | string | null;
  deliveryTimeSlot: string | null;
  orderAmount: string;
  paidAmount: string;
  paymentStatus: string;
  shopName: string;
  packageName: string;
  packageVariant: string | null;
  products: Array<{
    sku: string;
    name: string;
    color: string;
    quantity: number;
    unitPrice?: number;
    isGift: boolean;
  }>;
  gifts: Array<{
    sku: string;
    name: string;
    color: string;
    quantity: number;
    unitPrice?: number;
    isGift: boolean;
  }>;
  createdAt: Date | string;
  notes: string | null;
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  return `${dateStr} ${timeStr} HKT`;
}

function formatCurrency(value: number): string {
  return `HKD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getTimeSlotLabel(slot: string | null): string {
  if (!slot) return "-";
  const slots: Record<string, string> = {
    morning: "上午 (9:00-12:00)",
    afternoon: "下午 (12:00-18:00)",
    evening: "晚間 (18:00-21:00)",
  };
  return slots[slot] || slot;
}

function getPaymentStatusLabel(status: string): string {
  if (status === "paid") return "已付款";
  if (status === "partial") return "部分付款";
  return "未付款";
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return;
  }
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on("finish", () => { fileStream.close(); resolve(); });
      fileStream.on("error", reject);
    });
    request.on("error", reject);
    request.setTimeout(30000, () => { request.destroy(); reject(new Error("Download timeout")); });
  });
}

async function ensureFont(): Promise<string> {
  await downloadFile(FONT_CDN_URL, FONT_CACHE_PATH);
  return FONT_CACHE_PATH;
}

const LOGO_PNG_CACHE_PATH = path.join("/tmp", "company_logo_converted.png");

async function ensureLogo(): Promise<Buffer | null> {
  try {
    if (fs.existsSync(LOGO_PNG_CACHE_PATH) && fs.statSync(LOGO_PNG_CACHE_PATH).size > 0) {
      return fs.readFileSync(LOGO_PNG_CACHE_PATH);
    }
    await downloadFile(LOGO_CDN_URL, LOGO_CACHE_PATH);
    const pngBuffer = await sharp(LOGO_CACHE_PATH).png().toBuffer();
    fs.writeFileSync(LOGO_PNG_CACHE_PATH, pngBuffer);
    return pngBuffer;
  } catch (err) {
    console.error("[PDF] Logo load error:", err);
    return null;
  }
}

// Black-themed color palette
const BLACK = "#000000";
const DARK = "#1a1a1a";
const DARK_TEXT = "#222222";
const MEDIUM = "#555555";
const LIGHT_TEXT = "#777777";
const BORDER = "#cccccc";
const LIGHT_BORDER = "#e5e5e5";
const TABLE_HEADER_BG = "#f5f5f5";
const WHITE = "#ffffff";

async function buildPdf(order: OrderForPdf, docType: string, docTitle: string): Promise<Buffer> {
  const fontPath = await ensureFont();
  const logoBuffer = await ensureLogo();

  const orderAmount = Number(order.orderAmount);
  const paidAmount = Number(order.paidAmount || 0);
  const balance = orderAmount - paidAmount;
  const hasUnitPrice = order.products.some(p => (p.unitPrice || 0) > 0);
  const totalProducts = order.products.reduce((sum, p) => sum + p.quantity, 0);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    bufferPages: true,
  });

  doc.registerFont("NotoSansTC", fontPath);
  doc.font("NotoSansTC");

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageWidth = doc.page.width;
  const mL = 50;
  const mR = 50;
  const cW = pageWidth - mL - mR;

  // ===== TITLE =====
  let y = 40;
  doc.fontSize(28).fillColor(BLACK).text(docTitle, mL, y);
  y += 40;

  // ===== LOGO =====
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, mL, y, { width: 60, height: 60 });
    } catch { /* skip */ }
  }
  y += 70;

  // ===== ORDER META INFO =====
  const labelX = mL;
  const valueX = mL + 70;
  const metaFontSize = 9.5;
  const metaLineHeight = 16;

  const metaFields = [
    { label: "商鋪名稱", value: order.shopName || "ReadyGo HK" },
    { label: docType === "quotation" ? "報價編號" : docType === "invoice" ? "發票編號" : "收據編號", value: order.orderNumber },
    { label: "下單日期", value: formatDateTime(order.createdAt) },
    { label: "列印日期", value: formatDateTime(new Date()) },
    { label: "送貨方式", value: "本地送貨" },
    { label: "付款狀態", value: getPaymentStatusLabel(order.paymentStatus) },
  ];

  metaFields.forEach((field) => {
    doc.fontSize(metaFontSize).fillColor(BLACK).text(field.label, labelX, y, { continued: false });
    doc.fontSize(metaFontSize).fillColor(DARK_TEXT).text(field.value, valueX, y);
    y += metaLineHeight;
  });

  y += 10;

  // ===== CUSTOMER & DELIVERY INFO (side by side) =====
  // Thin separator line
  doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(LIGHT_BORDER).lineWidth(0.5).stroke();
  y += 12;

  const halfW = cW / 2;

  // Left: Customer info
  doc.fontSize(10).fillColor(BLACK).text("顧客資料", mL, y);
  y += 16;
  doc.fontSize(9.5).fillColor(DARK_TEXT).text(order.customerName, mL, y);
  y += 14;
  doc.text(`+852${order.customerPhone}`, mL, y);
  y += 14;
  if (order.customerEmail) {
    doc.text(order.customerEmail, mL, y);
    y += 14;
  }

  // Right: Delivery info (positioned at same starting y as customer)
  const deliveryStartY = y - (order.customerEmail ? 44 : 30) - 16;
  const rightX = mL + halfW + 20;
  doc.fontSize(10).fillColor(BLACK).text("送貨詳情", rightX, deliveryStartY);
  let ry = deliveryStartY + 16;
  doc.fontSize(9.5).fillColor(DARK_TEXT).text(order.customerName, rightX, ry);
  ry += 14;
  doc.text(`+852${order.customerPhone}`, rightX, ry);
  ry += 14;
  doc.text("本地送貨", rightX, ry);
  ry += 14;

  // Delivery address (may be multi-line)
  const addressLines = order.deliveryAddress.split("\n");
  addressLines.forEach((line) => {
    doc.text(line.trim(), rightX, ry, { width: halfW - 20 });
    ry += 14;
  });

  // Use the larger y value
  y = Math.max(y, ry) + 16;

  // ===== PRODUCTS TABLE =====
  // Separator
  doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  y += 2;

  // Table header background
  const headerH = 26;
  doc.rect(mL, y, cW, headerH).fillColor(TABLE_HEADER_BG).fill();
  doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.moveTo(mL, y + headerH).lineTo(pageWidth - mR, y + headerH).strokeColor(BORDER).lineWidth(0.5).stroke();

  // Column widths
  const colProduct = hasUnitPrice ? cW * 0.44 : cW * 0.60;
  const colUnitPrice = hasUnitPrice ? cW * 0.16 : 0;
  const colQty = cW * 0.16;
  const colTotal = hasUnitPrice ? cW * 0.24 : cW * 0.24;

  // Header text
  doc.fontSize(9).fillColor(BLACK);
  doc.text(`已購商品 (x${totalProducts})`, mL + 8, y + 7, { width: colProduct - 8 });
  if (hasUnitPrice) {
    doc.text("單價", mL + colProduct, y + 7, { width: colUnitPrice, align: "right" });
  }
  doc.text(`數量 (x${totalProducts})`, mL + colProduct + colUnitPrice, y + 7, { width: colQty, align: "right" });
  doc.text("總數", mL + colProduct + colUnitPrice + colQty, y + 7, { width: colTotal - 8, align: "right" });

  y += headerH;

  // Product rows
  order.products.forEach((p) => {
    const unitPrice = Number(p.unitPrice || 0);
    const subtotal = unitPrice > 0 ? unitPrice * p.quantity : 0;
    const rowH = 48;

    // Page break check
    if (y + rowH > doc.page.height - 100) {
      doc.addPage();
      y = 40;
    }

    // Product name (bold-like, larger)
    doc.fontSize(9.5).fillColor(BLACK).text(p.name + (p.color ? ` ${p.color}` : ""), mL + 8, y + 10, { width: colProduct - 16 });
    doc.fontSize(8).fillColor(LIGHT_TEXT).text(`SKU: ${p.sku}`, mL + 8, y + 26, { width: colProduct - 16 });

    if (hasUnitPrice) {
      doc.fontSize(9).fillColor(DARK_TEXT).text(
        unitPrice > 0 ? formatCurrency(unitPrice) : "-",
        mL + colProduct, y + 16, { width: colUnitPrice, align: "right" }
      );
    }

    doc.fontSize(9).fillColor(DARK_TEXT).text(
      `x${p.quantity}`,
      mL + colProduct + colUnitPrice, y + 16, { width: colQty, align: "right" }
    );

    doc.fontSize(9).fillColor(BLACK).text(
      hasUnitPrice && subtotal > 0 ? formatCurrency(subtotal) : formatCurrency(unitPrice > 0 ? subtotal : 0),
      mL + colProduct + colUnitPrice + colQty, y + 16, { width: colTotal - 8, align: "right" }
    );

    // Row separator
    y += rowH;
    doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(LIGHT_BORDER).lineWidth(0.5).stroke();
  });

  y += 4;

  // ===== GIFTS TABLE =====
  if (order.gifts.length > 0) {
    if (y + 60 > doc.page.height - 100) {
      doc.addPage();
      y = 40;
    }

    y += 8;
    // Gift header
    const giftHeaderH = 26;
    doc.rect(mL, y, cW, giftHeaderH).fillColor(TABLE_HEADER_BG).fill();
    doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(BORDER).lineWidth(0.5).stroke();
    doc.moveTo(mL, y + giftHeaderH).lineTo(pageWidth - mR, y + giftHeaderH).strokeColor(BORDER).lineWidth(0.5).stroke();

    const totalGifts = order.gifts.reduce((sum, g) => sum + g.quantity, 0);
    doc.fontSize(9).fillColor(BLACK);
    doc.text(`贈品 (x${totalGifts})`, mL + 8, y + 7, { width: cW * 0.6 });
    doc.text(`數量 (x${totalGifts})`, mL + cW * 0.6, y + 7, { width: cW * 0.4 - 8, align: "right" });

    y += giftHeaderH;

    order.gifts.forEach((g) => {
      const rowH = 48;
      if (y + rowH > doc.page.height - 100) {
        doc.addPage();
        y = 40;
      }

      doc.fontSize(9.5).fillColor(BLACK).text(g.name + (g.color ? ` ${g.color}` : ""), mL + 8, y + 10, { width: cW * 0.55 });
      doc.fontSize(8).fillColor(LIGHT_TEXT).text(`SKU: ${g.sku}`, mL + 8, y + 26, { width: cW * 0.55 });
      doc.fontSize(9).fillColor(DARK_TEXT).text(`x${g.quantity}`, mL + cW * 0.6, y + 16, { width: cW * 0.4 - 8, align: "right" });

      y += rowH;
      doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(LIGHT_BORDER).lineWidth(0.5).stroke();
    });

    y += 4;
  }

  // ===== SUMMARY TABLE =====
  if (y + 120 > doc.page.height - 80) {
    doc.addPage();
    y = 40;
  }

  y += 10;

  // Summary rows (right-aligned table)
  const summaryLabelX = mL + cW * 0.55;
  const summaryValueX = mL + cW * 0.75;
  const summaryValueW = cW * 0.25 - 8;
  const summaryRowH = 24;

  // Top border for summary
  doc.moveTo(summaryLabelX, y).lineTo(pageWidth - mR, y).strokeColor(BORDER).lineWidth(0.5).stroke();

  // Subtotal
  y += 6;
  doc.fontSize(9).fillColor(DARK_TEXT).text("小計", summaryLabelX, y, { width: cW * 0.2, align: "right" });
  doc.fontSize(9).fillColor(BLACK).text(formatCurrency(orderAmount), summaryValueX, y, { width: summaryValueW, align: "right" });
  y += summaryRowH;

  // Shipping
  doc.fontSize(9).fillColor(DARK_TEXT).text("運送費用", summaryLabelX, y, { width: cW * 0.2, align: "right" });
  doc.fontSize(9).fillColor(BLACK).text("+HKD 0.00", summaryValueX, y, { width: summaryValueW, align: "right" });
  y += summaryRowH;

  // Discount
  doc.fontSize(9).fillColor(DARK_TEXT).text("折扣優惠", summaryLabelX, y, { width: cW * 0.2, align: "right" });
  doc.fontSize(9).fillColor(BLACK).text("-HKD 0.00", summaryValueX, y, { width: summaryValueW, align: "right" });
  y += summaryRowH;

  if (docType === "receipt" || docType === "invoice") {
    // Paid amount
    doc.fontSize(9).fillColor(DARK_TEXT).text("已付金額", summaryLabelX, y, { width: cW * 0.2, align: "right" });
    doc.fontSize(9).fillColor(BLACK).text(formatCurrency(paidAmount), summaryValueX, y, { width: summaryValueW, align: "right" });
    y += summaryRowH;

    if (balance > 0) {
      doc.fontSize(9).fillColor(DARK_TEXT).text("應付餘額", summaryLabelX, y, { width: cW * 0.2, align: "right" });
      doc.fontSize(9).fillColor("#cc0000").text(formatCurrency(balance), summaryValueX, y, { width: summaryValueW, align: "right" });
      y += summaryRowH;
    }
  }

  // Total line with top border
  doc.moveTo(summaryLabelX, y).lineTo(pageWidth - mR, y).strokeColor(BLACK).lineWidth(1).stroke();
  y += 8;
  doc.fontSize(10).fillColor(BLACK).text("總數", summaryLabelX, y, { width: cW * 0.2, align: "right" });
  doc.fontSize(11).fillColor(BLACK).text(formatCurrency(orderAmount), summaryValueX, y, { width: summaryValueW, align: "right" });
  y += 30;

  // ===== DELIVERY INFO (below summary) =====
  if (order.deliveryDate || order.deliveryTimeSlot) {
    if (y + 40 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(LIGHT_BORDER).lineWidth(0.5).stroke();
    y += 10;
    doc.fontSize(9).fillColor(LIGHT_TEXT).text("送貨日期", mL, y);
    doc.fillColor(DARK_TEXT).text(formatDate(order.deliveryDate), mL + 60, y);
    if (order.deliveryTimeSlot) {
      doc.fillColor(LIGHT_TEXT).text("送貨時段", mL + 200, y);
      doc.fillColor(DARK_TEXT).text(getTimeSlotLabel(order.deliveryTimeSlot), mL + 260, y);
    }
    y += 20;
  }

  // ===== NOTES =====
  if (order.notes) {
    if (y + 40 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }
    doc.fontSize(9).fillColor(LIGHT_TEXT).text("備註", mL, y);
    y += 14;
    doc.fontSize(9).fillColor(DARK_TEXT).text(order.notes, mL, y, { width: cW });
    y += 20;
  }

  // ===== FOOTER =====
  // Place footer after content with enough spacing
  if (y + 60 > doc.page.height - 40) {
    doc.addPage();
    y = 40;
  }
  y = Math.max(y + 20, doc.page.height - 80);
  doc.moveTo(mL, y).lineTo(pageWidth - mR, y).strokeColor(LIGHT_BORDER).lineWidth(0.5).stroke();
  y += 10;
  doc.fontSize(9).fillColor(BLACK).text("奧創數碼有限公司 Ultron Digital Limited", mL, y, { width: cW, align: "center" });
  y += 14;
  doc.fontSize(8.5).fillColor(MEDIUM).text("+852 4485 9954  |  https://ultrondigital.com.hk/", mL, y, { width: cW, align: "center" });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function generateQuotationPdf(order: OrderForPdf): Promise<Buffer> {
  return buildPdf(order, "quotation", "報價單");
}

export async function generateInvoicePdf(order: OrderForPdf): Promise<Buffer> {
  return buildPdf(order, "invoice", "發票");
}

export async function generateReceiptPdf(order: OrderForPdf): Promise<Buffer> {
  return buildPdf(order, "receipt", "收據");
}
