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
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
}

function formatCurrency(value: number): string {
  return `HK$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

async function downloadFile(url: string, destPath: string): Promise<void> {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return; // Already cached
  }
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const request = protocol.get(url, (response) => {
      // Handle redirects
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
    // Check if already converted
    if (fs.existsSync(LOGO_PNG_CACHE_PATH) && fs.statSync(LOGO_PNG_CACHE_PATH).size > 0) {
      return fs.readFileSync(LOGO_PNG_CACHE_PATH);
    }
    await downloadFile(LOGO_CDN_URL, LOGO_CACHE_PATH);
    // Convert to PNG (the file might be WebP despite .png extension)
    const pngBuffer = await sharp(LOGO_CACHE_PATH).png().toBuffer();
    fs.writeFileSync(LOGO_PNG_CACHE_PATH, pngBuffer);
    return pngBuffer;
  } catch (err) {
    console.error("[PDF] Logo load error:", err);
    return null;
  }
}

// Colors
const BLUE = "#1e40af";
const LIGHT_BLUE = "#2563eb";
const DARK_GRAY = "#333333";
const MEDIUM_GRAY = "#666666";
const LIGHT_GRAY = "#888888";
const BORDER_COLOR = "#e2e8f0";
const BG_LIGHT = "#f8fafc";
const WHITE = "#ffffff";

function drawRoundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number) {
  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);
}

async function buildPdf(order: OrderForPdf, docType: string, docTitle: string): Promise<Buffer> {
  const fontPath = await ensureFont();
  const logoBuffer = await ensureLogo();

  const orderAmount = Number(order.orderAmount);
  const paidAmount = Number(order.paidAmount || 0);
  const balance = orderAmount - paidAmount;
  const hasUnitPrice = order.products.some(p => (p.unitPrice || 0) > 0);

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
    bufferPages: true,
  });

  // Register font
  doc.registerFont("NotoSansTC", fontPath);
  doc.font("NotoSansTC");

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const pageWidth = doc.page.width;
  const marginLeft = 45;
  const marginRight = 45;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // ===== HEADER =====
  let y = 40;

  // Logo + Company info
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, marginLeft, y, { width: 48, height: 48 });
    } catch { /* skip logo if error */ }
  }

  const textStartX = marginLeft + 58;
  doc.fontSize(16).fillColor(BLUE).text("奧創數碼有限公司", textStartX, y + 2);
  doc.fontSize(10).fillColor(BLUE).text("Ultron Digital Company Limited", textStartX, y + 22);
  doc.fontSize(8).fillColor(MEDIUM_GRAY).text("電話：+852 4485 9954 | 網站：https://ultrondigital.com.hk/", textStartX, y + 36);

  // Doc title on the right
  const titleWidth = doc.widthOfString(docTitle);
  doc.fontSize(22).fillColor(BLUE).text(docTitle, pageWidth - marginRight - 120, y, { width: 120, align: "right" });
  doc.fontSize(9).fillColor(MEDIUM_GRAY).text(`編號：${order.orderNumber}`, pageWidth - marginRight - 150, y + 30, { width: 150, align: "right" });
  doc.fontSize(9).text(`日期：${formatDate(order.createdAt)}`, pageWidth - marginRight - 150, y + 44, { width: 150, align: "right" });

  // Blue line under header
  y += 60;
  doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).strokeColor(LIGHT_BLUE).lineWidth(2.5).stroke();
  y += 15;

  // ===== INFO BOXES =====
  const boxWidth = (contentWidth - 15) / 2;
  const boxHeight = 90;

  // Customer info box
  drawRoundedRect(doc, marginLeft, y, boxWidth, boxHeight, 6);
  doc.fillColor(BG_LIGHT).fill().strokeColor(BORDER_COLOR).lineWidth(0.8).stroke();

  doc.fontSize(10).fillColor(BLUE).text("客戶資料", marginLeft + 12, y + 10);
  doc.fontSize(9).fillColor(LIGHT_GRAY).text("姓名", marginLeft + 12, y + 30);
  doc.fillColor(DARK_GRAY).text(order.customerName, marginLeft + 60, y + 30);
  doc.fillColor(LIGHT_GRAY).text("電話", marginLeft + 12, y + 48);
  doc.fillColor(DARK_GRAY).text(order.customerPhone, marginLeft + 60, y + 48);
  doc.fillColor(LIGHT_GRAY).text("電郵", marginLeft + 12, y + 66);
  doc.fillColor(DARK_GRAY).text(order.customerEmail || "-", marginLeft + 60, y + 66);

  // Order info box
  const rightBoxX = marginLeft + boxWidth + 15;
  drawRoundedRect(doc, rightBoxX, y, boxWidth, boxHeight, 6);
  doc.fillColor(BG_LIGHT).fill().strokeColor(BORDER_COLOR).lineWidth(0.8).stroke();

  doc.fontSize(10).fillColor(BLUE).text("訂單資料", rightBoxX + 12, y + 10);
  doc.fontSize(9).fillColor(LIGHT_GRAY).text("商鋪", rightBoxX + 12, y + 30);
  doc.fillColor(DARK_GRAY).text(order.shopName || "ReadyGo HK", rightBoxX + 60, y + 30);
  doc.fillColor(LIGHT_GRAY).text("套餐", rightBoxX + 12, y + 48);
  doc.fillColor(DARK_GRAY).text(order.packageName, rightBoxX + 60, y + 48, { width: boxWidth - 80 });
  if (order.packageVariant) {
    doc.fillColor(LIGHT_GRAY).text("規格", rightBoxX + 12, y + 66);
    doc.fillColor(DARK_GRAY).text(order.packageVariant, rightBoxX + 60, y + 66);
  }

  y += boxHeight + 12;

  // ===== META ROW (4 items) =====
  const metaWidth = (contentWidth - 36) / 4;
  const metaHeight = 42;
  const metaItems = [
    { label: "送貨地址", value: order.deliveryAddress.substring(0, 20) + (order.deliveryAddress.length > 20 ? "..." : "") },
    { label: "送貨日期", value: formatDate(order.deliveryDate) },
    { label: "送貨時段", value: getTimeSlotLabel(order.deliveryTimeSlot) },
    { label: "付款狀態", value: order.paymentStatus === "paid" ? "已付款" : order.paymentStatus === "partial" ? "部分付款" : "未付款" },
  ];

  metaItems.forEach((item, i) => {
    const mx = marginLeft + i * (metaWidth + 12);
    drawRoundedRect(doc, mx, y, metaWidth, metaHeight, 4);
    doc.fillColor(BG_LIGHT).fill().strokeColor(BORDER_COLOR).lineWidth(0.5).stroke();
    doc.fontSize(7.5).fillColor(LIGHT_GRAY).text(item.label, mx + 8, y + 6);
    doc.fontSize(9).fillColor(DARK_GRAY).text(item.value, mx + 8, y + 22, { width: metaWidth - 16 });
  });

  y += metaHeight + 18;

  // ===== PRODUCTS TABLE =====
  if (order.products.length > 0) {
    doc.fontSize(11).fillColor(DARK_GRAY).text("產品明細", marginLeft, y);
    y += 6;
    doc.moveTo(marginLeft, y + 12).lineTo(pageWidth - marginRight, y + 12).strokeColor(BORDER_COLOR).lineWidth(1.5).stroke();
    y += 18;

    // Table header
    const headerHeight = 28;
    doc.rect(marginLeft, y, contentWidth, headerHeight).fillColor(BLUE).fill();

    let colX = marginLeft;
    const colProduct = hasUnitPrice ? contentWidth * 0.42 : contentWidth * 0.65;
    const colUnitPrice = hasUnitPrice ? contentWidth * 0.18 : 0;
    const colQty = hasUnitPrice ? contentWidth * 0.15 : contentWidth * 0.35;
    const colSubtotal = hasUnitPrice ? contentWidth * 0.25 : 0;

    doc.fontSize(9).fillColor(WHITE);
    doc.text("產品", colX + 10, y + 8, { width: colProduct - 10 });
    if (hasUnitPrice) {
      doc.text("單價", colX + colProduct, y + 8, { width: colUnitPrice, align: "right" });
    }
    doc.text("數量", colX + colProduct + colUnitPrice, y + 8, { width: colQty, align: "center" });
    if (hasUnitPrice) {
      doc.text("小計", colX + colProduct + colUnitPrice + colQty, y + 8, { width: colSubtotal - 10, align: "right" });
    }

    y += headerHeight;

    // Table rows
    order.products.forEach((p, idx) => {
      const unitPrice = Number(p.unitPrice || 0);
      const subtotal = unitPrice * p.quantity;
      const rowHeight = 36;

      // Check if we need a new page
      if (y + rowHeight > doc.page.height - 80) {
        doc.addPage();
        y = 40;
      }

      // Alternating row background
      if (idx % 2 === 0) {
        doc.rect(marginLeft, y, contentWidth, rowHeight).fillColor("#fafbfc").fill();
      }

      doc.fontSize(9).fillColor(DARK_GRAY).text(p.name, colX + 10, y + 6, { width: colProduct - 20 });
      doc.fontSize(7.5).fillColor(LIGHT_GRAY).text(`SKU: ${p.sku}${p.color ? ` | ${p.color}` : ""}`, colX + 10, y + 20, { width: colProduct - 20 });

      if (hasUnitPrice) {
        doc.fontSize(9).fillColor(DARK_GRAY).text(unitPrice > 0 ? formatCurrency(unitPrice) : "-", colX + colProduct, y + 12, { width: colUnitPrice, align: "right" });
      }
      doc.fontSize(9).fillColor(DARK_GRAY).text(String(p.quantity), colX + colProduct + colUnitPrice, y + 12, { width: colQty, align: "center" });
      if (hasUnitPrice) {
        doc.fontSize(9).fillColor(DARK_GRAY).text(unitPrice > 0 ? formatCurrency(subtotal) : "-", colX + colProduct + colUnitPrice + colQty, y + 12, { width: colSubtotal - 10, align: "right" });
      }

      // Bottom border
      doc.moveTo(marginLeft, y + rowHeight).lineTo(pageWidth - marginRight, y + rowHeight).strokeColor("#eeeeee").lineWidth(0.5).stroke();
      y += rowHeight;
    });

    y += 10;
  }

  // ===== GIFTS TABLE =====
  if (order.gifts.length > 0) {
    // Check if we need a new page
    if (y + 80 > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }

    doc.fontSize(11).fillColor("#334155").text("贈品", marginLeft, y);
    y += 6;
    doc.moveTo(marginLeft, y + 12).lineTo(pageWidth - marginRight, y + 12).strokeColor("#cbd5e1").lineWidth(1.5).stroke();
    y += 18;

    // Gift table header
    const giftHeaderHeight = 28;
    doc.rect(marginLeft, y, contentWidth, giftHeaderHeight).fillColor("#475569").fill();

    doc.fontSize(9).fillColor(WHITE);
    doc.text("贈品", marginLeft + 10, y + 8, { width: contentWidth * 0.65 });
    doc.text("數量", marginLeft + contentWidth * 0.65, y + 8, { width: contentWidth * 0.35, align: "center" });

    y += giftHeaderHeight;

    order.gifts.forEach((g, idx) => {
      const rowHeight = 36;

      if (y + rowHeight > doc.page.height - 80) {
        doc.addPage();
        y = 40;
      }

      if (idx % 2 === 0) {
        doc.rect(marginLeft, y, contentWidth, rowHeight).fillColor("#fafbfc").fill();
      }

      doc.fontSize(9).fillColor("#334155").text(`[\u8D08] ${g.name}`, marginLeft + 10, y + 6, { width: contentWidth * 0.6 });
      doc.fontSize(7.5).fillColor(LIGHT_GRAY).text(`SKU: ${g.sku}${g.color ? ` | ${g.color}` : ""}`, marginLeft + 10, y + 20, { width: contentWidth * 0.6 });
      doc.fontSize(9).fillColor(DARK_GRAY).text(String(g.quantity), marginLeft + contentWidth * 0.65, y + 12, { width: contentWidth * 0.35, align: "center" });

      doc.moveTo(marginLeft, y + rowHeight).lineTo(pageWidth - marginRight, y + rowHeight).strokeColor("#eeeeee").lineWidth(0.5).stroke();
      y += rowHeight;
    });

    y += 10;
  }

  // ===== SUMMARY BOX =====
  if (y + 120 > doc.page.height - 80) {
    doc.addPage();
    y = 40;
  }

  const summaryWidth = 220;
  const summaryX = pageWidth - marginRight - summaryWidth;

  doc.fontSize(9).fillColor(MEDIUM_GRAY).text("訂單金額", summaryX, y);
  doc.fillColor(DARK_GRAY).text(formatCurrency(orderAmount), summaryX + 80, y, { width: summaryWidth - 80, align: "right" });
  y += 18;
  doc.moveTo(summaryX, y).lineTo(summaryX + summaryWidth, y).strokeColor("#eeeeee").lineWidth(0.5).stroke();
  y += 6;

  if (docType === "receipt" || docType === "invoice") {
    doc.fontSize(9).fillColor(MEDIUM_GRAY).text("已付金額", summaryX, y);
    doc.fillColor(DARK_GRAY).text(formatCurrency(paidAmount), summaryX + 80, y, { width: summaryWidth - 80, align: "right" });
    y += 18;
    doc.moveTo(summaryX, y).lineTo(summaryX + summaryWidth, y).strokeColor("#eeeeee").lineWidth(0.5).stroke();
    y += 6;

    if (balance > 0) {
      doc.fontSize(9).fillColor(MEDIUM_GRAY).text("應付餘額", summaryX, y);
      doc.fillColor("#dc2626").text(formatCurrency(balance), summaryX + 80, y, { width: summaryWidth - 80, align: "right" });
      y += 18;
      doc.moveTo(summaryX, y).lineTo(summaryX + summaryWidth, y).strokeColor("#eeeeee").lineWidth(0.5).stroke();
      y += 6;
    }
  }

  // Total line
  doc.moveTo(summaryX, y).lineTo(summaryX + summaryWidth, y).strokeColor(BLUE).lineWidth(2).stroke();
  y += 8;
  doc.fontSize(14).fillColor(BLUE).text("總計", summaryX, y);
  doc.text(formatCurrency(orderAmount), summaryX + 60, y, { width: summaryWidth - 60, align: "right" });
  y += 28;

  // ===== NOTES =====
  if (order.notes) {
    if (y + 60 > doc.page.height - 60) {
      doc.addPage();
      y = 40;
    }

    drawRoundedRect(doc, marginLeft, y, contentWidth, 50, 6);
    doc.fillColor("#fffbeb").fill().strokeColor("#fde68a").lineWidth(0.8).stroke();

    doc.fontSize(9).fillColor("#92400e").text("備註", marginLeft + 12, y + 10);
    doc.fontSize(8.5).fillColor("#78350f").text(order.notes, marginLeft + 12, y + 26, { width: contentWidth - 24 });
    y += 55;
  }

  // ===== FOOTER =====
  // Ensure footer is on the last page at the bottom
  const footerY = doc.page.height - 35;
  doc.fontSize(7.5).fillColor("#999999").text(
    "奧創數碼有限公司 Ultron Digital Limited | 電話：+852 4485 9954 | https://ultrondigital.com.hk/",
    marginLeft, footerY, { width: contentWidth, align: "center" }
  );

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
