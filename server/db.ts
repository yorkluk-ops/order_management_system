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

function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD${year}${month}${day}${random}`;
}

export async function createOrder(order: Omit<InsertOrder, 'orderNumber'>): Promise<{ id: number; orderNumber: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const orderNumber = generateOrderNumber();
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
