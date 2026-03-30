import { eq, desc, and, like, or, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, orders, packages, products, orderProducts, orderPackages, customers, payments, shops, shopInventory, inventoryLogs, purchaseOrders, purchaseOrderItems, stockTransfers, stockTransferItems, InsertOrder, InsertPackage, InsertProduct, InsertOrderProduct, InsertOrderPackage, InsertCustomer, InsertPayment, Order, Package, Product, OrderProduct, OrderPackage, Customer, Payment, Shop, InsertShop, ShopInventory, InsertShopInventory, InventoryLog, InsertInventoryLog, PurchaseOrder, InsertPurchaseOrder, PurchaseOrderItem, InsertPurchaseOrderItem, StockTransfer, InsertStockTransfer, StockTransferItem, InsertStockTransferItem } from "../drizzle/schema";
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

export async function getAllPackages(includeInactive = false): Promise<Package[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (includeInactive) {
    return db.select().from(packages).orderBy(desc(packages.createdAt));
  }
  
  return db.select().from(packages).where(eq(packages.isActive, "yes")).orderBy(desc(packages.createdAt));
}

export async function getPackageById(id: number): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(packages).where(eq(packages.id, id)).limit(1);
  return result[0];
}

export async function getPackageByCode(code: string): Promise<Package | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(packages).where(eq(packages.code, code)).limit(1);
  return result[0];
}

export async function createPackage(pkg: InsertPackage): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(packages).values(pkg);
  return Number(result[0].insertId);
}

export async function updatePackage(id: number, data: Partial<InsertPackage>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(packages).set(data).where(eq(packages.id, id));
}

export async function deletePackage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 軟刪除
  await db.update(packages).set({ isActive: "no" }).where(eq(packages.id, id));
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
  shopName?: string;
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
  
  if (filters?.shopName) {
    conditions.push(eq(orders.shopName, filters.shopName));
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

export async function getOrderStatsByDateRange(dateFrom?: string, dateTo?: string) {
  const db = await getDb();
  if (!db) {
    return {
      totalOrders: 0,
      totalSales: 0,
      totalCommission: 0,
      pendingOrders: 0,
      completedOrders: 0,
      dailyStats: [],
    };
  }

  const conditions = [];
  if (dateFrom) {
    conditions.push(gte(orders.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    conditions.push(lte(orders.createdAt, endDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, pendingResult, completedResult, dailyResult] = await Promise.all([
    db.select({
      count: sql<number>`count(*)`,
      sales: sql<number>`COALESCE(SUM(orderAmount), 0)`,
      commission: sql<number>`COALESCE(SUM(commission), 0)`,
    }).from(orders).where(whereClause),
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause ? and(whereClause, eq(orders.status, "pending")) : eq(orders.status, "pending")),
    db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause ? and(whereClause, eq(orders.status, "completed")) : eq(orders.status, "completed")),
    db.select({
      date: sql<string>`DATE(createdAt)`,
      count: sql<number>`count(*)`,
      sales: sql<number>`COALESCE(SUM(orderAmount), 0)`,
      commission: sql<number>`COALESCE(SUM(commission), 0)`,
    }).from(orders)
      .where(whereClause)
      .groupBy(sql`DATE(createdAt)`)
      .orderBy(sql`DATE(createdAt)`),
  ]);

  return {
    totalOrders: Number(totalResult[0]?.count || 0),
    totalSales: Number(totalResult[0]?.sales || 0),
    totalCommission: Number(totalResult[0]?.commission || 0),
    pendingOrders: Number(pendingResult[0]?.count || 0),
    completedOrders: Number(completedResult[0]?.count || 0),
    dailyStats: dailyResult.map(d => ({
      date: String(d.date),
      count: Number(d.count),
      sales: Number(d.sales),
      commission: Number(d.commission),
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
  
  if (filters?.shopName) {
    conditions.push(eq(orders.shopName, filters.shopName));
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


// ==================== Order Package Operations ====================

export async function addOrderPackages(orderId: number, items: Omit<InsertOrderPackage, 'orderId'>[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (items.length === 0) return;
  
  const values = items.map(item => ({
    ...item,
    orderId,
  }));
  
  await db.insert(orderPackages).values(values);
}

export async function getOrderPackages(orderId: number): Promise<OrderPackage[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(orderPackages)
    .where(eq(orderPackages.orderId, orderId));
}

export async function deleteOrderPackages(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(orderPackages).where(eq(orderPackages.orderId, orderId));
}


// ==================== Customer Operations ====================

export async function createCustomer(customer: InsertCustomer): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(customers).values(customer);
  return result[0].insertId;
}

export async function updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(customers).set(customer).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(customers).where(eq(customers.id, id));
}

export async function getCustomerById(id: number): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(customers).where(eq(customers.id, id));
  return result[0] || null;
}

export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(customers).where(eq(customers.phone, phone));
  return result[0] || null;
}

export async function getCustomers(search?: string, limit = 50, offset = 0): Promise<Customer[]> {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(customers);
  
  if (search) {
    query = query.where(
      or(
        like(customers.name, `%${search}%`),
        like(customers.phone, `%${search}%`),
        like(customers.email, `%${search}%`)
      )
    ) as typeof query;
  }
  
  return query.orderBy(desc(customers.updatedAt)).limit(limit).offset(offset);
}

export async function updateCustomerStats(customerId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 計算客戶的訂單數和總消費
  const stats = await db.select({
    totalOrders: sql<number>`COUNT(*)`,
    totalSpent: sql<string>`COALESCE(SUM(${orders.orderAmount}), 0)`,
  })
    .from(orders)
    .where(eq(orders.customerId, customerId));
  
  if (stats[0]) {
    await db.update(customers).set({
      totalOrders: stats[0].totalOrders,
      totalSpent: stats[0].totalSpent,
    }).where(eq(customers.id, customerId));
  }
}

// ==================== Payment Operations ====================

export async function createPayment(payment: InsertPayment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(payments).values(payment);
  return result[0].insertId;
}

export async function updatePayment(id: number, payment: Partial<InsertPayment>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(payments).set(payment).where(eq(payments.id, id));
}

export async function getPaymentsByOrderId(orderId: number): Promise<Payment[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt));
}

export async function getPaymentByStripeIntentId(stripePaymentIntentId: string): Promise<Payment | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(payments).where(eq(payments.stripePaymentIntentId, stripePaymentIntentId));
  return result[0] || null;
}

export async function updateOrderPaymentStatus(orderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 計算已付金額
  const paymentStats = await db.select({
    totalPaid: sql<string>`COALESCE(SUM(CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END), 0)`,
  })
    .from(payments)
    .where(eq(payments.orderId, orderId));
  
  const paidAmount = parseFloat(paymentStats[0]?.totalPaid || '0');
  
  // 獲取訂單金額
  const order = await db.select({ orderAmount: orders.orderAmount }).from(orders).where(eq(orders.id, orderId));
  const orderAmount = parseFloat(order[0]?.orderAmount || '0');
  
  // 更新付款狀態
  let paymentStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
  if (paidAmount >= orderAmount) {
    paymentStatus = 'paid';
  } else if (paidAmount > 0) {
    paymentStatus = 'partial';
  }
  
  await db.update(orders).set({
    paymentStatus,
    paidAmount: paidAmount.toString(),
  }).where(eq(orders.id, orderId));
}

export async function getOrdersByCustomerId(customerId: number): Promise<Order[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
}


// ==================== Shop Operations ====================

export async function getAllShops(includeInactive = false): Promise<Shop[]> {
  const db = await getDb();
  if (!db) return [];
  
  if (includeInactive) {
    return db.select().from(shops).orderBy(shops.sortOrder, shops.name);
  }
  return db.select().from(shops).where(eq(shops.isActive, "yes")).orderBy(shops.sortOrder, shops.name);
}

export async function getShopById(id: number): Promise<Shop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  return result[0];
}

export async function getShopByName(name: string): Promise<Shop | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(shops).where(eq(shops.name, name)).limit(1);
  return result[0];
}

export async function createShop(data: Omit<InsertShop, "id" | "createdAt" | "updatedAt">): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(shops).values(data);
  return Number(result[0].insertId);
}

export async function updateShop(id: number, data: Partial<InsertShop>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(shops).set(data).where(eq(shops.id, id));
}

export async function deleteShop(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(shops).where(eq(shops.id, id));
}


// ==================== Shop Inventory Operations ====================

export async function getShopInventory(shopId: number): Promise<(ShopInventory & { product?: Product })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    inventory: shopInventory,
    product: products,
  })
    .from(shopInventory)
    .leftJoin(products, eq(shopInventory.productId, products.id))
    .where(eq(shopInventory.shopId, shopId));
  
  return result.map(r => ({
    ...r.inventory,
    product: r.product || undefined,
  }));
}

export async function getShopInventoryByProduct(productId: number): Promise<(ShopInventory & { shop?: Shop })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    inventory: shopInventory,
    shop: shops,
  })
    .from(shopInventory)
    .leftJoin(shops, eq(shopInventory.shopId, shops.id))
    .where(eq(shopInventory.productId, productId));
  
  return result.map(r => ({
    ...r.inventory,
    shop: r.shop || undefined,
  }));
}

export async function getShopInventoryItem(productId: number, shopId: number): Promise<ShopInventory | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select()
    .from(shopInventory)
    .where(and(
      eq(shopInventory.productId, productId),
      eq(shopInventory.shopId, shopId)
    ))
    .limit(1);
  
  return result[0];
}

export async function upsertShopInventory(productId: number, shopId: number, quantity: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getShopInventoryItem(productId, shopId);
  if (existing) {
    await db.update(shopInventory)
      .set({ quantity })
      .where(eq(shopInventory.id, existing.id));
  } else {
    await db.insert(shopInventory).values({ productId, shopId, quantity });
  }
}

export async function adjustShopInventory(productId: number, shopId: number, quantityChange: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getShopInventoryItem(productId, shopId);
  const currentQty = existing?.quantity || 0;
  const newQty = currentQty + quantityChange;
  
  if (existing) {
    await db.update(shopInventory)
      .set({ quantity: newQty })
      .where(eq(shopInventory.id, existing.id));
  } else {
    await db.insert(shopInventory).values({ productId, shopId, quantity: newQty });
  }
  
  return newQty;
}

export async function getAllShopInventory(): Promise<(ShopInventory & { product?: Product; shop?: Shop })[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    inventory: shopInventory,
    product: products,
    shop: shops,
  })
    .from(shopInventory)
    .leftJoin(products, eq(shopInventory.productId, products.id))
    .leftJoin(shops, eq(shopInventory.shopId, shops.id))
    .orderBy(shops.sortOrder, shops.name, products.sku);
  
  return result.map(r => ({
    ...r.inventory,
    product: r.product || undefined,
    shop: r.shop || undefined,
  }));
}

// ==================== Inventory Log Operations ====================

export async function createInventoryLog(log: Omit<InsertInventoryLog, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(inventoryLogs).values(log);
  return Number(result[0].insertId);
}

export async function getInventoryLogs(filters?: {
  productId?: number;
  shopId?: number;
  changeType?: string;
  limit?: number;
  offset?: number;
}): Promise<InventoryLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.productId) conditions.push(eq(inventoryLogs.productId, filters.productId));
  if (filters?.shopId) conditions.push(eq(inventoryLogs.shopId, filters.shopId));
  if (filters?.changeType) conditions.push(eq(inventoryLogs.changeType, filters.changeType as InventoryLog['changeType']));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  return db.select()
    .from(inventoryLogs)
    .where(whereClause)
    .orderBy(desc(inventoryLogs.createdAt))
    .limit(filters?.limit || 100)
    .offset(filters?.offset || 0);
}

// ==================== Purchase Order Operations ====================

async function generatePONumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const now = new Date();
  const prefix = `PO${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const result = await db.select({ poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .where(like(purchaseOrders.poNumber, `${prefix}%`))
    .orderBy(desc(purchaseOrders.poNumber))
    .limit(1);
  
  let nextNumber = 1;
  if (result.length > 0 && result[0].poNumber) {
    const lastNumber = result[0].poNumber.replace(prefix, '');
    nextNumber = parseInt(lastNumber, 10) + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

export async function createPurchaseOrder(data: Omit<InsertPurchaseOrder, 'poNumber'>): Promise<{ id: number; poNumber: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const poNumber = await generatePONumber();
  const result = await db.insert(purchaseOrders).values({
    ...data,
    poNumber,
  });
  
  return { id: Number(result[0].insertId), poNumber };
}

export async function getPurchaseOrderById(id: number): Promise<PurchaseOrder | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result[0];
}

export async function getPurchaseOrders(filters?: {
  status?: string;
  shopId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ orders: PurchaseOrder[]; total: number }> {
  const db = await getDb();
  if (!db) return { orders: [], total: 0 };
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(purchaseOrders.status, filters.status as PurchaseOrder['status']));
  if (filters?.shopId) conditions.push(eq(purchaseOrders.shopId, filters.shopId));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [ordersResult, countResult] = await Promise.all([
    db.select()
      .from(purchaseOrders)
      .where(whereClause)
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0),
    db.select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(whereClause),
  ]);
  
  return {
    orders: ordersResult,
    total: Number(countResult[0]?.count || 0),
  };
}

export async function updatePurchaseOrder(id: number, data: Partial<InsertPurchaseOrder>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}

export async function deletePurchaseOrder(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 刪除明細
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
  // 刪除主單
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
}

// ==================== Purchase Order Item Operations ====================

export async function addPurchaseOrderItems(purchaseOrderId: number, items: Omit<InsertPurchaseOrderItem, 'purchaseOrderId'>[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (items.length === 0) return;
  
  const values = items.map(item => ({
    ...item,
    purchaseOrderId,
  }));
  
  await db.insert(purchaseOrderItems).values(values);
}

export async function getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

export async function deletePurchaseOrderItems(purchaseOrderId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
}

// ==================== Stock Transfer Operations ====================

async function generateTransferNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const now = new Date();
  const prefix = `TR${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  
  const result = await db.select({ transferNumber: stockTransfers.transferNumber })
    .from(stockTransfers)
    .where(like(stockTransfers.transferNumber, `${prefix}%`))
    .orderBy(desc(stockTransfers.transferNumber))
    .limit(1);
  
  let nextNumber = 1;
  if (result.length > 0 && result[0].transferNumber) {
    const lastNumber = result[0].transferNumber.replace(prefix, '');
    nextNumber = parseInt(lastNumber, 10) + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

export async function createStockTransfer(data: Omit<InsertStockTransfer, 'transferNumber'>): Promise<{ id: number; transferNumber: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const transferNumber = await generateTransferNumber();
  const result = await db.insert(stockTransfers).values({
    ...data,
    transferNumber,
  });
  
  return { id: Number(result[0].insertId), transferNumber };
}

export async function getStockTransferById(id: number): Promise<StockTransfer | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(stockTransfers).where(eq(stockTransfers.id, id)).limit(1);
  return result[0];
}

export async function getStockTransfers(filters?: {
  status?: string;
  fromShopId?: number;
  toShopId?: number;
  limit?: number;
  offset?: number;
}): Promise<{ transfers: StockTransfer[]; total: number }> {
  const db = await getDb();
  if (!db) return { transfers: [], total: 0 };
  
  const conditions = [];
  if (filters?.status) conditions.push(eq(stockTransfers.status, filters.status as StockTransfer['status']));
  if (filters?.fromShopId) conditions.push(eq(stockTransfers.fromShopId, filters.fromShopId));
  if (filters?.toShopId) conditions.push(eq(stockTransfers.toShopId, filters.toShopId));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [transfersResult, countResult] = await Promise.all([
    db.select()
      .from(stockTransfers)
      .where(whereClause)
      .orderBy(desc(stockTransfers.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0),
    db.select({ count: sql<number>`count(*)` })
      .from(stockTransfers)
      .where(whereClause),
  ]);
  
  return {
    transfers: transfersResult,
    total: Number(countResult[0]?.count || 0),
  };
}

export async function updateStockTransfer(id: number, data: Partial<InsertStockTransfer>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(stockTransfers).set(data).where(eq(stockTransfers.id, id));
}

// ==================== Stock Transfer Item Operations ====================

export async function addStockTransferItems(transferId: number, items: Omit<InsertStockTransferItem, 'transferId'>[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (items.length === 0) return;
  
  const values = items.map(item => ({
    ...item,
    transferId,
  }));
  
  await db.insert(stockTransferItems).values(values);
}

export async function getStockTransferItems(transferId: number): Promise<StockTransferItem[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(stockTransferItems)
    .where(eq(stockTransferItems.transferId, transferId));
}
