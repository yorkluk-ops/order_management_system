import puppeteer from "puppeteer";

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
  packageName: string;
  packageVariant: string | null;
  products: Array<{
    sku: string;
    name: string;
    color: string;
    quantity: number;
    isGift: boolean;
  }>;
  gifts: Array<{
    sku: string;
    name: string;
    color: string;
    quantity: number;
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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildHtml(order: OrderForPdf, docType: string, docTitle: string): string {
  const orderAmount = Number(order.orderAmount);
  const paidAmount = Number(order.paidAmount || 0);
  const balance = orderAmount - paidAmount;

  const productRows = order.products.map((p) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">
        <div style="font-weight: 500;">${escapeHtml(p.name)}</div>
        <div style="font-size: 12px; color: #888;">SKU: ${escapeHtml(p.sku)}${p.color ? ` | ${escapeHtml(p.color)}` : ""}</div>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: center;">${p.quantity}</td>
    </tr>
  `).join("");

  const giftRows = order.gifts.map((g) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">
        <div style="font-weight: 500; color: #e91e8c;">🎁 ${escapeHtml(g.name)}</div>
        <div style="font-size: 12px; color: #888;">SKU: ${escapeHtml(g.sku)}${g.color ? ` | ${escapeHtml(g.color)}` : ""}</div>
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: center;">${g.quantity}</td>
    </tr>
  `).join("");

  const paymentStatusText = order.paymentStatus === "paid" ? "已付款" : 
    order.paymentStatus === "partial" ? "部分付款" : "未付款";
  const statusClass = order.paymentStatus === "paid" ? "status-paid" : 
    order.paymentStatus === "partial" ? "status-partial" : "status-unpaid";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', sans-serif;
      font-size: 14px;
      color: #333;
      line-height: 1.6;
      background: white;
    }
    
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      position: relative;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 3px solid #2563eb;
    }
    
    .company-info { flex: 1; }
    
    .company-name {
      font-size: 22px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 4px;
    }
    
    .company-detail {
      font-size: 12px;
      color: #666;
      line-height: 1.8;
    }
    
    .doc-title-box { text-align: right; }
    
    .doc-title {
      font-size: 28px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 8px;
    }
    
    .doc-number {
      font-size: 13px;
      color: #666;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }
    
    .info-box {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }
    
    .info-box-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }
    
    .info-row {
      display: flex;
      margin-bottom: 4px;
    }
    
    .info-label {
      width: 80px;
      font-size: 12px;
      color: #888;
      flex-shrink: 0;
    }
    
    .info-value {
      font-size: 13px;
      color: #333;
      font-weight: 500;
    }
    
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .meta-item {
      background: #f8fafc;
      border-radius: 6px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
    }
    
    .meta-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 2px;
    }
    
    .meta-value {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }
    
    .products-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    
    .products-table thead {
      background: #1e40af;
      color: white;
    }
    
    .products-table th {
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
    }
    
    .products-table th:last-child {
      text-align: center;
      width: 80px;
    }
    
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #333;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .summary-box {
      margin-left: auto;
      width: 280px;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }
    
    .summary-row.total {
      border-bottom: none;
      border-top: 2px solid #1e40af;
      margin-top: 4px;
      padding-top: 12px;
      font-size: 18px;
      font-weight: 700;
      color: #1e40af;
    }
    
    .summary-label { color: #666; }
    .summary-value { font-weight: 600; }
    
    .notes-box {
      margin-top: 25px;
      padding: 14px;
      background: #fffbeb;
      border-radius: 8px;
      border: 1px solid #fde68a;
    }
    
    .notes-title {
      font-size: 13px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 6px;
    }
    
    .notes-content {
      font-size: 12px;
      color: #78350f;
      white-space: pre-wrap;
    }
    
    .footer {
      margin-top: 40px;
      text-align: center;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #999;
    }
    
    .payment-status {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .status-paid { background: #dcfce7; color: #166534; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-unpaid { background: #fee2e2; color: #991b1b; }
    
    .gift-section { margin-top: 5px; }
    .gift-section .section-title { color: #e91e8c; border-bottom-color: #fbcfe8; }
    .gift-section thead { background: #ec4899; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-info">
        <div class="company-name">奧創數碼有限公司</div>
        <div class="company-detail">
          Ultron Digital Limited<br>
          電話：+852 4485 9954<br>
          網站：https://ultrondigital.com.hk/
        </div>
      </div>
      <div class="doc-title-box">
        <div class="doc-title">${docTitle}</div>
        <div class="doc-number">
          編號：${escapeHtml(order.orderNumber)}<br>
          日期：${formatDate(order.createdAt)}<br>
          列印：${formatDate(new Date())}
        </div>
      </div>
    </div>
    
    <div class="meta-grid">
      <div class="meta-item">
        <div class="meta-label">商鋪</div>
        <div class="meta-value">ReadyGo HK</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">套餐</div>
        <div class="meta-value">${escapeHtml(order.packageName)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">送貨日期</div>
        <div class="meta-value">${formatDate(order.deliveryDate)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">付款狀態</div>
        <div class="meta-value">
          <span class="payment-status ${statusClass}">${paymentStatusText}</span>
        </div>
      </div>
    </div>
    
    <div class="info-grid">
      <div class="info-box">
        <div class="info-box-title">顧客資料</div>
        <div class="info-row">
          <span class="info-label">客戶名稱</span>
          <span class="info-value">${escapeHtml(order.customerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">電話</span>
          <span class="info-value">${escapeHtml(order.customerPhone)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">電郵</span>
          <span class="info-value">${escapeHtml(order.customerEmail || "-")}</span>
        </div>
      </div>
      <div class="info-box">
        <div class="info-box-title">送貨詳情</div>
        <div class="info-row">
          <span class="info-label">收件人</span>
          <span class="info-value">${escapeHtml(order.customerName)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">電話</span>
          <span class="info-value">${escapeHtml(order.customerPhone)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">時段</span>
          <span class="info-value">${getTimeSlotLabel(order.deliveryTimeSlot)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">地址</span>
          <span class="info-value">${escapeHtml(order.deliveryAddress)}</span>
        </div>
      </div>
    </div>
    
    <div class="section-title">已購商品 (${order.products.length} 項)</div>
    <table class="products-table">
      <thead>
        <tr>
          <th>商品</th>
          <th style="text-align: center;">數量</th>
        </tr>
      </thead>
      <tbody>
        ${productRows || '<tr><td colspan="2" style="padding: 12px; text-align: center; color: #999;">無產品記錄</td></tr>'}
      </tbody>
    </table>
    
    ${order.gifts.length > 0 ? `
    <div class="gift-section">
      <div class="section-title">🎁 贈品 (${order.gifts.length} 項)</div>
      <table class="products-table">
        <thead>
          <tr>
            <th>贈品</th>
            <th style="text-align: center;">數量</th>
          </tr>
        </thead>
        <tbody>${giftRows}</tbody>
      </table>
    </div>
    ` : ""}
    
    ${order.packageVariant ? `
    <div style="margin-bottom: 15px; font-size: 13px; color: #666;">
      套餐變體：${escapeHtml(order.packageVariant)}
    </div>
    ` : ""}
    
    <div class="summary-box">
      <div class="summary-row">
        <span class="summary-label">小計</span>
        <span class="summary-value">${formatCurrency(orderAmount)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">運送費用</span>
        <span class="summary-value">免費</span>
      </div>
      ${docType === "receipt" && paidAmount > 0 ? `
      <div class="summary-row">
        <span class="summary-label">已付金額</span>
        <span class="summary-value" style="color: #16a34a;">${formatCurrency(paidAmount)}</span>
      </div>
      ${balance > 0 ? `
      <div class="summary-row">
        <span class="summary-label">應付餘額</span>
        <span class="summary-value" style="color: #dc2626;">${formatCurrency(balance)}</span>
      </div>
      ` : ""}
      ` : ""}
      <div class="summary-row total">
        <span>總計</span>
        <span>${formatCurrency(orderAmount)}</span>
      </div>
    </div>
    
    ${order.notes ? `
    <div class="notes-box">
      <div class="notes-title">備註</div>
      <div class="notes-content">${escapeHtml(order.notes)}</div>
    </div>
    ` : ""}
    
    <div class="footer">
      奧創數碼有限公司 Ultron Digital Limited | 電話：+852 4485 9954 | https://ultrondigital.com.hk/
    </div>
  </div>
</body>
</html>`;
}

let browserInstance: any = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/chromium-browser",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });
  }
  return browserInstance;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

export async function generateQuotationPdf(order: OrderForPdf): Promise<Buffer> {
  const html = buildHtml(order, "quotation", "報價單");
  return htmlToPdf(html);
}

export async function generateInvoicePdf(order: OrderForPdf): Promise<Buffer> {
  const html = buildHtml(order, "invoice", "發票");
  return htmlToPdf(html);
}

export async function generateReceiptPdf(order: OrderForPdf): Promise<Buffer> {
  const html = buildHtml(order, "receipt", "收據");
  return htmlToPdf(html);
}
