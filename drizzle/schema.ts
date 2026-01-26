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
  
  // 訂單狀態
  status: mysqlEnum("status", ["pending", "confirmed", "delivering", "completed", "cancelled"]).default("pending").notNull(),
  
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
