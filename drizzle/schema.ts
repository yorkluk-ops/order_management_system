import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 套餐資料表 - 儲存所有可選套餐
 */
export const packages = mysqlTable("packages", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull(),
  originalValue: decimal("originalValue", { precision: 10, scale: 2 }),
  savings: varchar("savings", { length: 100 }),
  freeGift: text("freeGift"),
  // 贈品連結產品 ID
  giftProductId: int("giftProductId"),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Package = typeof packages.$inferSelect;
export type InsertPackage = typeof packages.$inferInsert;

/**
 * 訂單資料表 - 儲存客戶訂單
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 32 }).notNull().unique(),
  
  // 客戶資料
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 50 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  
  // 商鋪名稱
  shopName: varchar("shopName", { length: 255 }).default("ReadyGo HK").notNull(),
  
  // 套餐資料
  packageId: int("packageId").notNull(),
  packageName: varchar("packageName", { length: 255 }).notNull(),
  packageVariant: varchar("packageVariant", { length: 255 }),
  
  // 金額
  orderAmount: decimal("orderAmount", { precision: 10, scale: 2 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull(),
  
  // 送貨資料
  deliveryAddress: text("deliveryAddress").notNull(),
  deliveryDate: timestamp("deliveryDate"),
  deliveryTimeSlot: varchar("deliveryTimeSlot", { length: 50 }),
  trackingNumber: varchar("trackingNumber", { length: 100 }),
  
  // 訂單狀態
  status: mysqlEnum("status", ["pending", "confirmed", "delivering", "completed", "cancelled"]).default("pending").notNull(),
  
  // 付款狀態
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid"]).default("unpaid").notNull(),
  paidAmount: decimal("paidAmount", { precision: 10, scale: 2 }).default("0").notNull(),
  
  // 關聯顧客
  customerId: int("customerId"),
  
  // 備註
  notes: text("notes"),
  
  // 時間戳
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * 產品資料表 - 儲存自建產品
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 100 }),
  price: decimal("price", { precision: 10, scale: 2 }).default("0"),
  // 全域庫存欄位（保留向後兼容，新系統使用 shopInventory）
  stockHK: int("stockHK").default(0).notNull(),
  stockCN: int("stockCN").default(0).notNull(),
  // 贈品標記
  isGift: mysqlEnum("isGift", ["yes", "no"]).default("no").notNull(),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * 訂單產品關聯表 - 儲存訂單中的產品明細
 */
export const orderProducts = mysqlTable("orderProducts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  sku: varchar("sku", { length: 64 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  color: varchar("color", { length: 100 }),
  quantity: int("quantity").default(1).notNull(),
  // 產品單價（記錄下單時的售價）
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0"),
  // 標記是否為贈品
  isGift: mysqlEnum("isGift", ["yes", "no"]).default("no").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderProduct = typeof orderProducts.$inferSelect;
export type InsertOrderProduct = typeof orderProducts.$inferInsert;

/**
 * 訂單套餐關聯表 - 儲存訂單中的套餐明細（支援多套餐）
 */
export const orderPackages = mysqlTable("orderPackages", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  packageId: int("packageId"),
  packageCode: varchar("packageCode", { length: 32 }).notNull(),
  packageName: varchar("packageName", { length: 255 }).notNull(),
  packageVariant: varchar("packageVariant", { length: 255 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  commission: decimal("commission", { precision: 10, scale: 2 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderPackage = typeof orderPackages.$inferSelect;
export type InsertOrderPackage = typeof orderPackages.$inferInsert;

/**
 * 顧客資料表 - 儲存顧客資訊
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 320 }),
  address: text("address"),
  notes: text("notes"),
  // 統計資料
  totalOrders: int("totalOrders").default(0).notNull(),
  totalSpent: decimal("totalSpent", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * 付款記錄表 - 儲存訂單付款記錄
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  // 付款方式
  paymentMethod: mysqlEnum("paymentMethod", ["stripe", "cash", "bank_transfer", "other"]).notNull(),
  // 付款金額
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  // Stripe 相關
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripePaymentLinkId: varchar("stripePaymentLinkId", { length: 255 }),
  // 付款狀態
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  // 銀行轉帳過數圖片
  proofImageUrl: text("proofImageUrl"),
  // 備註
  notes: text("notes"),
  // 時間戳
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * 商鋪資料表 - 儲存商鋪名稱
 */
export const shops = mysqlTable("shops", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: mysqlEnum("isActive", ["yes", "no"]).default("yes").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Shop = typeof shops.$inferSelect;
export type InsertShop = typeof shops.$inferInsert;

// ==================== 庫存管理系統新增資料表 ====================

/**
 * 商鋪庫存表 - 每間商鋪的獨立庫存
 * 每個 (productId, shopId) 組合代表該商鋪的該產品庫存量
 */
export const shopInventory = mysqlTable("shopInventory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  shopId: int("shopId").notNull(),
  quantity: int("quantity").default(0).notNull(),
  lastUpdated: timestamp("lastUpdated").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShopInventory = typeof shopInventory.$inferSelect;
export type InsertShopInventory = typeof shopInventory.$inferInsert;

/**
 * 庫存變動記錄表 - 記錄每次庫存變動的原因和詳情
 */
export const inventoryLogs = mysqlTable("inventoryLogs", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  shopId: int("shopId").notNull(),
  quantityChange: int("quantityChange").notNull(),
  quantityAfter: int("quantityAfter").notNull(),
  // 變動類型：manual=手動調整, purchase=採購入庫, transfer_in=調撥入庫, transfer_out=調撥出庫, order=銷售扣減, order_cancel=訂單取消恢復
  changeType: mysqlEnum("changeType", ["manual", "purchase", "transfer_in", "transfer_out", "order", "order_cancel"]).notNull(),
  // 關聯的單據 ID（採購單ID、調撥單ID、訂單ID）
  referenceId: int("referenceId"),
  referenceType: varchar("referenceType", { length: 50 }),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type InsertInventoryLog = typeof inventoryLogs.$inferInsert;

/**
 * 採購訂單表 - 記錄向供應商的採購
 */
export const purchaseOrders = mysqlTable("purchaseOrders", {
  id: int("id").autoincrement().primaryKey(),
  // 採購單號（自動生成）
  poNumber: varchar("poNumber", { length: 32 }).notNull().unique(),
  // 供應商名稱
  supplier: varchar("supplier", { length: 255 }).notNull(),
  // 目標商鋪（採購入庫到哪間商鋪）
  shopId: int("shopId").notNull(),
  // 採購日期
  orderDate: timestamp("orderDate").notNull(),
  // 狀態：draft=草稿, ordered=已下單, received=已收貨, cancelled=已取消
  status: mysqlEnum("status", ["draft", "ordered", "received", "cancelled"]).default("draft").notNull(),
  // 採購單 PDF 文件 URL（上傳到 S3）
  pdfUrl: text("pdfUrl"),
  // 總金額
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default("0").notNull(),
  // 備註
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

/**
 * 採購訂單明細表 - 採購的產品明細
 */
export const purchaseOrderItems = mysqlTable("purchaseOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  purchaseOrderId: int("purchaseOrderId").notNull(),
  productId: int("productId").notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  color: varchar("color", { length: 100 }),
  quantity: int("quantity").notNull(),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

/**
 * 庫存調撥表 - 商鋪間的庫存轉移
 */
export const stockTransfers = mysqlTable("stockTransfers", {
  id: int("id").autoincrement().primaryKey(),
  // 調撥單號（自動生成）
  transferNumber: varchar("transferNumber", { length: 32 }).notNull().unique(),
  // 來源商鋪
  fromShopId: int("fromShopId").notNull(),
  // 目標商鋪
  toShopId: int("toShopId").notNull(),
  // 狀態：pending=待確認, completed=已完成, cancelled=已取消
  status: mysqlEnum("status", ["pending", "completed", "cancelled"]).default("pending").notNull(),
  // 備註
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockTransfer = typeof stockTransfers.$inferSelect;
export type InsertStockTransfer = typeof stockTransfers.$inferInsert;

/**
 * 庫存調撥明細表 - 調撥的產品明細
 */
export const stockTransferItems = mysqlTable("stockTransferItems", {
  id: int("id").autoincrement().primaryKey(),
  transferId: int("transferId").notNull(),
  productId: int("productId").notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  color: varchar("color", { length: 100 }),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockTransferItem = typeof stockTransferItems.$inferSelect;
export type InsertStockTransferItem = typeof stockTransferItems.$inferInsert;

/**
 * External storefront imports.
 * One row per (platform, externalOrderId) so a bot retry cannot create a second OMS order
 * or deduct stock twice. Shop ids are not stored; shopName is resolved at import time.
 */
export const externalOrders = mysqlTable("externalOrders", {
  id: int("id").autoincrement().primaryKey(),
  platform: varchar("platform", { length: 32 }).notNull(),
  externalOrderId: varchar("externalOrderId", { length: 191 }).notNull(),
  shopName: varchar("shopName", { length: 255 }).notNull(),
  orderId: int("orderId"),
  status: mysqlEnum("status", ["processing", "completed"]).default("processing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("externalOrders_platform_externalOrderId_unique").on(table.platform, table.externalOrderId),
]);

export type ExternalOrder = typeof externalOrders.$inferSelect;
export type InsertExternalOrder = typeof externalOrders.$inferInsert;
