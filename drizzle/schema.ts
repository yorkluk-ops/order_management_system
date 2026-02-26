import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

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
  // 庫存欄位
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
