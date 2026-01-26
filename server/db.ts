import { eq, desc, and, like, or, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, orders, packages, products, orderProducts, InsertOrder, InsertPackage, InsertProduct, InsertOrderProduct, Order, Package, Product, OrderProduct } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Operations ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ==================== Package Operations ====================

export async function getAllPackages(): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(packages).where(eq(packages.isActive, "yes"));
  return result;
}

export async function getPackageById(id: number): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return result[0];
}

export async function createPackage(pkg: InsertPackage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(packages).values(pkg);
  return Number(result[0].insertId);
}

export async function seedPackages(pkgList: InsertPackage[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const pkg of pkgList) {
    await db.insert(packages).values(pkg).onDuplicateKeyUpdate({
      set: {
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        commission: pkg.commission,
        originalValue: pkg.originalValue,
        savings: pkg.savings,
        freeGift: pkg.freeGift,
        isActive: pkg.isActive || "yes",
      },
    });
  }
}

// ==================== Order Operations ====================

async function generateOrderNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 獲取當前最大的訂單編號
  const result = await db.select({ orderNumber: orders.orderNumber })
    .from(orders)
    .where(like(orders.orderNumber, '26EGB%'))
    .orderBy(desc(orders.orderNumber))
    .limit(1);
  
  let nextNumber = 1;
  if (result.length > 0 && result[0].orderNumber) {
    const lastNumber = result[0].orderNumber.replace('26EGB', '');
    nextNumber = parseInt(lastNumber, 10) + 1;
  }
  
  return `26EGB${nextNumber.toString().padStart(4, '0')}`;
}

export async function createOrder(order: Omit<InsertOrder, 'orderNumber'>): Promise<{ id: number; orderNumber: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const orderNumber = await generateOrderNumber();
  const result = await db.insert(orders).values({
    ...order,
    orderNumber,
  });
  
  return { id: Number(result[0].insertId), orderNumber };
}

export async function getOrderById(id: number): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result[0];
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return result[0];
}

export interface OrderFilters {
  search?: string;
  status?: string;
  packageId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  deliveryDateFrom?: Date;
  deliveryDateTo?: Date;
}

export async function getOrders(filters?: OrderFilters, limit = 100, offset = 0): Promise<{ orders: Order[]; total: number }> {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const conditions = [];
  
  if (filters?.search) {
    conditions.push(
      or(
        like(orders.customerName, `%${filters.search}%`),
        like(orders.customerPhone, `%${filters.search}%`),
        like(orders.orderNumber, `%${filters.search}%`)
      )
    );
  }
  
  if (filters?.status) {
    conditions.push(eq(orders.status, filters.status as Order['status']));
  }
  
  if (filters?.packageId) {
    conditions.push(eq(orders.packageId, filters.packageId));
  }
  
  if (filters?.dateFrom) {
    conditions.push(gte(orders.createdAt, filters.dateFrom));
  }
  
  if (filters?.dateTo) {
    conditions.push(lte(orders.createdAt, filters.dateTo));
  }
  
  if (filters?.deliveryDateFrom) {
    conditions.push(gte(orders.deliveryDate, filters.deliveryDateFrom));
  }
  
  if (filters?.deliveryDateTo) {
    conditions.push(lte(orders.deliveryDate, filters.deliveryDateTo));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [ordersResult, countResult] = await Promise.all([
    db.select()
      .from(orders)
      .where(whereClause)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause),
  ]);
  
  return {
    orders: ordersResult,
    total: Number(countResult[0]?.count || 0),
  };
}

export async function updateOrder(id: number, data: Partial<InsertOrder>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders).set(data).where(eq(orders.id, id));
}

export async function updateOrderStatus(id: number, status: Order['status']): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

export async function deleteOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(orders).where(eq(orders.id, id));
}

// ==================== Statistics Operations ====================

export interface OrderStats {
  totalOrders: number;
  totalSales: number;
  totalCommission: number;
  pendingOrders: number;
  completedOrders: number;
  packageStats: { packageName: string; count: number; sales: number }[];
}

export async function getOrderStats(): Promise<OrderStats> {
  const db = await getDb();
  if (!db) {
    return {
      totalOrders: 0,
      totalSales: 0,
      totalCommission: 0,
      pendingOrders: 0,
      completedOrders: 0,
      packageStats: [],
    };
  }
  
  const [
    totalResult,
    pendingResult,
    completedResult,
    packageStatsResult,
  ] = await Promise.all([
    db.select({
      count: sql<number>`count(*)`,
      sales: sql<number>`COALESCE(SUM(orderAmount), 0)`,
      commission: sql<number>`COALESCE(SUM(commission), 0)`,
    }).from(orders),
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.status, "pending")),
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.status, "completed")),
    db.select({
      packageName: orders.packageName,
      count: sql<number>`count(*)`,
      sales: sql<number>`COALESCE(SUM(orderAmount), 0)`,
    })
      .from(orders)
      .groupBy(orders.packageName),
  ]);
  
  return {
    totalOrders: Number(totalResult[0]?.count || 0),
    totalSales: Number(totalResult[0]?.sales || 0),
    totalCommission: Number(totalResult[0]?.commission || 0),
    pendingOrders: Number(pendingResult[0]?.count || 0),
    completedOrders: Number(completedResult[0]?.count || 0),
    packageStats: packageStatsResult.map(p => ({
      packageName: p.packageName,
      count: Number(p.count),
      sales: Number(p.sales),
    })),
  };
}

export async function getRecentOrders(limit = 10): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrdersForExport(filters?: OrderFilters): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.search) {
    conditions.push(
      or(
        like(orders.customerName, `%${filters.search}%`),
        like(orders.customerPhone, `%${filters.search}%`),
        like(orders.orderNumber, `%${filters.search}%`)
      )
    );
  }
  
  if (filters?.status) {
    conditions.push(eq(orders.status, filters.status as Order['status']));
  }
  
  if (filters?.packageId) {
    conditions.push(eq(orders.packageId, filters.packageId));
  }
  
  if (filters?.dateFrom) {
    conditions.push(gte(orders.createdAt, filters.dateFrom));
  }
  
  if (filters?.dateTo) {
    conditions.push(lte(orders.createdAt, filters.dateTo));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  return db.select()
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt));
}

// ==================== Product Operations ====================

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(products)
    .where(eq(products.isActive, "yes"))
    .orderBy(desc(products.createdAt));
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductBySku(sku: string): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
  return result[0];
}

export async function createProduct(product: InsertProduct): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(products).values(product);
  return Number(result[0].insertId);
}

export async function updateProduct(id: number, data: Partial<InsertProduct>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(products).set({ isActive: "no" }).where(eq(products.id, id));
}

// ==================== Order Product Operations ====================

export async function addOrderProducts(orderId: number, items: Omit<InsertOrderProduct, 'orderId'>[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (items.length === 0) return;
  
  const values = items.map(item => ({
    ...item,
    orderId,
  }));
  
  await db.insert(orderProducts).values(values);
}

export async function getOrderProducts(orderId: number): Promise<OrderProduct[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(orderProducts)
    .where(eq(orderProducts.orderId, orderId));
}

export async function deleteOrderProducts(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(orderProducts).where(eq(orderProducts.orderId, orderId));
}

// ==================== Stock Operations ====================

export async function updateProductStock(productId: number, quantityChange: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 扣減香港庫存（允許負數）
  await db.update(products)
    .set({ stockHK: sql`stockHK + ${quantityChange}` })
    .where(eq(products.id, productId));
}

export async function updateProductStockBySku(sku: string, quantityChange: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 扣減香港庫存（允許負數）
  await db.update(products)
    .set({ stockHK: sql`stockHK + ${quantityChange}` })
    .where(eq(products.sku, sku));
}

// ==================== Monthly Delivery Report ====================

export interface MonthlyDeliveryItem {
  sku: string;
  productName: string;
  color: string | null;
  months: { [key: number]: number }; // 1-12 月份對應的數量
  total: number;
}

export async function getMonthlyDeliveryReport(year: number): Promise<MonthlyDeliveryItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  // 獲取指定年份所有訂單的產品明細
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);
  
  const result = await db.select({
    sku: orderProducts.sku,
    productName: orderProducts.productName,
    color: orderProducts.color,
    quantity: orderProducts.quantity,
    deliveryDate: orders.deliveryDate,
  })
    .from(orderProducts)
    .innerJoin(orders, eq(orderProducts.orderId, orders.id))
    .where(
      and(
        gte(orders.deliveryDate, startDate),
        lte(orders.deliveryDate, endDate),
        // 排除已取消的訂單
        sql`${orders.status} != 'cancelled'`
      )
    );
  
  // 按 SKU 聚合數據
  const aggregated: { [sku: string]: MonthlyDeliveryItem } = {};
  
  for (const row of result) {
    if (!row.deliveryDate) continue;
    
    const month = new Date(row.deliveryDate).getMonth() + 1; // 1-12
    
    if (!aggregated[row.sku]) {
      aggregated[row.sku] = {
        sku: row.sku,
        productName: row.productName,
        color: row.color,
        months: {},
        total: 0,
      };
    }
    
    aggregated[row.sku].months[month] = (aggregated[row.sku].months[month] || 0) + row.quantity;
    aggregated[row.sku].total += row.quantity;
  }
  
  // 轉換為數組並排序
  return Object.values(aggregated).sort((a, b) => b.total - a.total);
}
