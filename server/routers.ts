import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createOrder,
  getOrderById,
  getOrders,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
  getOrderStatsByDateRange,
  getRecentOrders,
  getOrdersForExport,
  getAllProducts,
  getProductById,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  addOrderProducts,
  getOrderProducts,
  deleteOrderProducts,
  updateProductStockBySku,
  updateProductStock,
  getMonthlyDeliveryReport,
  getAllPackages,
  getPackageById,
  getPackageByCode,
  createPackage,
  updatePackage,
  deletePackage,
  addOrderPackages,
  getOrderPackages,
  deleteOrderPackages,
  // 顧客管理
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  getCustomerByPhone,
  getCustomers,
  updateCustomerStats,
  getOrdersByCustomerId,
  // 付款管理
  createPayment,
  updatePayment,
  getPaymentsByOrderId,
  getPaymentByStripeIntentId,
  updateOrderPaymentStatus,
  // 商鋪管理
  getAllShops,
  getShopById,
  getShopByName,
  createShop,
  updateShop,
  deleteShop,
  // 庫存管理
  getShopInventory,
  getShopInventoryByProduct,
  getShopInventoryItem,
  upsertShopInventory,
  adjustShopInventory,
  getAllShopInventory,
  createInventoryLog,
  getInventoryLogs,
  // 採購訂單
  createPurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrders,
  updatePurchaseOrder,
  deletePurchaseOrder,
  addPurchaseOrderItems,
  getPurchaseOrderItems,
  deletePurchaseOrderItems,
  // 庫存調撥
  createStockTransfer,
  getStockTransferById,
  getStockTransfers,
  updateStockTransfer,
  addStockTransferItems,
  getStockTransferItems,
} from "./db";
import { ORDER_STATUS } from "../shared/packages";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import { generateQuotationPdf, generateInvoicePdf, generateReceiptPdf, type OrderForPdf, generateTransferPdf, type TransferForPdf } from "./pdfService";

// 日期格式化函數 YYYYMMDD
function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 套餐管理
  packages: router({
    list: protectedProcedure.query(async () => {
      return getAllPackages();
    }),

    listAll: protectedProcedure.query(async () => {
      return getAllPackages(true);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getPackageById(input.id);
      }),

    getByCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return getPackageByCode(input.code);
      }),

    create: protectedProcedure
      .input(z.object({
        code: z.string().min(1, "請輸入套餐代碼"),
        name: z.string().min(1, "請輸入套餐名稱"),
        description: z.string().optional(),
        price: z.number().nonnegative(),
        commission: z.number().nonnegative(),
        originalValue: z.number().nonnegative().optional(),
        savings: z.string().optional(),
        freeGift: z.string().optional(),
        giftProductId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        // 檢查代碼是否已存在
        const existing = await getPackageByCode(input.code);
        if (existing) {
          throw new Error("套餐代碼已存在");
        }

        const id = await createPackage({
          code: input.code,
          name: input.name,
          description: input.description || null,
          price: input.price.toString(),
          commission: input.commission.toString(),
          originalValue: input.originalValue?.toString() || null,
          savings: input.savings || null,
          freeGift: input.freeGift || null,
          giftProductId: input.giftProductId || null,
          isActive: "yes",
        });

        return { id, code: input.code };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        code: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        price: z.number().nonnegative().optional(),
        commission: z.number().nonnegative().optional(),
        originalValue: z.number().nonnegative().optional(),
        savings: z.string().optional(),
        freeGift: z.string().optional(),
        giftProductId: z.number().nullable().optional(),
        isActive: z.enum(["yes", "no"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};

        if (data.code) {
          const existing = await getPackageByCode(data.code);
          if (existing && existing.id !== id) {
            throw new Error("套餐代碼已存在");
          }
          updateData.code = data.code;
        }
        if (data.name) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description || null;
        if (data.price !== undefined) updateData.price = data.price.toString();
        if (data.commission !== undefined) updateData.commission = data.commission.toString();
        if (data.originalValue !== undefined) updateData.originalValue = data.originalValue?.toString() || null;
        if (data.savings !== undefined) updateData.savings = data.savings || null;
        if (data.freeGift !== undefined) updateData.freeGift = data.freeGift || null;
        if (data.giftProductId !== undefined) updateData.giftProductId = data.giftProductId;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        await updatePackage(id, updateData as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deletePackage(input.id);
        return { success: true };
      }),
  }),

  // 訂單相關
  orders: router({
    create: protectedProcedure
      .input(z.object({
        customerName: z.string().min(1, "請輸入客戶姓名"),
        customerPhone: z.string().min(1, "請輸入聯絡電話"),
        customerEmail: z.string().email().optional().or(z.literal("")),
        packageCode: z.string().min(1, "請選擇套餐"),
        packageName: z.string().default("其他｜單件產品購買"),
        packageVariant: z.string().optional(),
        shopName: z.string().optional(),
        orderAmount: z.number().nonnegative(),
        commission: z.number().nonnegative(),
        deliveryAddress: z.string().min(1, "請輸入送貨地址"),
        deliveryDate: z.string().optional(),
        deliveryTimeSlot: z.string().optional(),
        notes: z.string().optional(),
        // 產品明細
        products: z.array(z.object({
          sku: z.string(),
          productName: z.string(),
          color: z.string().optional(),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative().optional(),
          isGift: z.boolean().optional(),
        })).optional(),
        // 贈品明細
        gifts: z.array(z.object({
          sku: z.string(),
          productName: z.string(),
          color: z.string().optional(),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative().optional(),
        })).optional(),
        // 套餐贈品產品 ID 列表（用於扣除庫存）
        packageGiftProductIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createOrder({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail || null,
          packageId: 1,
          packageName: input.packageName || "其他｜單件產品購買",
          packageVariant: input.packageVariant || null,
          shopName: input.shopName || "ReadyGo HK",
          orderAmount: input.orderAmount.toString(),
          commission: input.commission.toString(),
          deliveryAddress: input.deliveryAddress,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
          deliveryTimeSlot: input.deliveryTimeSlot || null,
          notes: input.notes || null,
          status: "pending",
          createdBy: ctx.user.id,
        });

        // 新增產品明細並扣除庫存
        const allProducts = [
          ...(input.products || []).map(p => ({ ...p, isGift: false })),
          ...(input.gifts || []).map(g => ({ ...g, isGift: true })),
        ];

        if (allProducts.length > 0) {
          await addOrderProducts(result.id, allProducts.map(p => ({
            sku: p.sku,
            productName: p.productName,
            color: p.color || null,
            quantity: p.quantity,
            unitPrice: (p.unitPrice !== undefined && p.unitPrice !== null) ? p.unitPrice.toString() : "0",
            isGift: p.isGift ? "yes" : "no",
          })));

          // 扣除香港庫存（允許負數）
          for (const product of allProducts) {
            await updateProductStockBySku(product.sku, -product.quantity);
          }

          // 同時扣除商鋪庫存（根據訂單的商鋪名稱找對應商鋪）
          const orderShopName = input.shopName || "ReadyGo HK";
          const matchedShop = await getShopByName(orderShopName);
          if (matchedShop) {
            for (const product of allProducts) {
              const dbProduct = await getProductBySku(product.sku);
              if (dbProduct) {
                const newQty = await adjustShopInventory(dbProduct.id, matchedShop.id, -product.quantity);
                await createInventoryLog({
                  productId: dbProduct.id,
                  shopId: matchedShop.id,
                  quantityChange: -product.quantity,
                  quantityAfter: newQty,
                  changeType: 'order',
                  referenceId: result.id,
                  referenceType: 'order',
                  notes: `訂單 ${result.orderNumber} 銷售扣減`,
                  createdBy: ctx.user.id,
                });
              }
            }
          }
        }

        // 扣除套餐贈品的庫存
        if (input.packageGiftProductIds && input.packageGiftProductIds.length > 0) {
          const orderShopName = input.shopName || "ReadyGo HK";
          const matchedShop = await getShopByName(orderShopName);
          for (const productId of input.packageGiftProductIds) {
            await updateProductStock(productId, -1);
            // 同時扣除商鋪庫存
            if (matchedShop) {
              const newQty = await adjustShopInventory(productId, matchedShop.id, -1);
              await createInventoryLog({
                productId,
                shopId: matchedShop.id,
                quantityChange: -1,
                quantityAfter: newQty,
                changeType: 'order',
                referenceId: result.id,
                referenceType: 'order',
                notes: `訂單 ${result.orderNumber} 套餐贈品扣減`,
                createdBy: ctx.user.id,
              });
            }
          }
        }

        // 發送通知給管理員
        await notifyOwner({
          title: `新訂單 ${result.orderNumber}`,
          content: `客戶：${input.customerName}\n套餐：${input.packageName}\n金額：$${input.orderAmount}\n送貨地址：${input.deliveryAddress}`,
        });

        return result;
      }),

    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        packageId: z.number().optional(),
        shopName: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        deliveryDateFrom: z.string().optional(),
        deliveryDateTo: z.string().optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        const filters = input ? {
          search: input.search,
          status: input.status,
          packageId: input.packageId,
          shopName: input.shopName,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          deliveryDateFrom: input.deliveryDateFrom ? new Date(input.deliveryDateFrom) : undefined,
          deliveryDateTo: input.deliveryDateTo ? new Date(input.deliveryDateTo) : undefined,
        } : undefined;

        return getOrders(filters, input?.limit || 20, input?.offset || 0);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await getOrderById(input.id);
        if (!order) return null;
        
        // 獲取訂單產品明細
        const orderProductsList = await getOrderProducts(input.id);
        
        // 獲取產品詳細資訊，優先使用 orderProducts 表格中的資料，如果沒有則從 products 表格獲取
        const productsWithDetails = await Promise.all(
          orderProductsList.map(async (op) => {
            // 如果 orderProducts 表格中有資料則直接使用，否則從 products 表格獲取
            const product = op.productId ? await getProductById(op.productId) : null;
            return {
              ...op,
              // 優先使用 orderProducts 表格中儲存的資料
              sku: op.sku || product?.sku || '',
              name: op.productName || product?.name || '',
              color: op.color || product?.color || '',
              unitPrice: Number(op.unitPrice || 0),
              isGift: op.isGift === 'yes',
            };
          })
        );
        
        // 分類產品和贈品
        const products = productsWithDetails.filter(p => !p.isGift);
        const gifts = productsWithDetails.filter(p => p.isGift);
        
        return {
          ...order,
          products,
          gifts,
        };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        customerName: z.string().min(1).optional(),
        customerPhone: z.string().min(1).optional(),
        customerEmail: z.string().email().optional().or(z.literal("")),
        packageName: z.string().optional(),
        packageVariant: z.string().optional(),
        shopName: z.string().optional(),
        orderAmount: z.number().nonnegative().optional(),
        commission: z.number().nonnegative().optional(),
        deliveryAddress: z.string().optional(),
        deliveryDate: z.string().optional(),
        deliveryTimeSlot: z.string().optional(),
        trackingNumber: z.string().optional(),
        notes: z.string().optional(),
        // 產品明細
        products: z.array(z.object({
          sku: z.string(),
          productName: z.string(),
          color: z.string().optional(),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative().optional(),
        })).optional(),
        // 贈品明細
        gifts: z.array(z.object({
          sku: z.string(),
          productName: z.string(),
          color: z.string().optional(),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, products, gifts, ...data } = input;
        const updateData: Record<string, unknown> = {};

        if (data.customerName) updateData.customerName = data.customerName;
        if (data.customerPhone) updateData.customerPhone = data.customerPhone;
        if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail || null;
        if (data.packageName) updateData.packageName = data.packageName;
        if (data.packageVariant !== undefined) updateData.packageVariant = data.packageVariant || null;
        if (data.shopName !== undefined) updateData.shopName = data.shopName;
        if (data.orderAmount !== undefined) updateData.orderAmount = data.orderAmount.toString();
        if (data.commission !== undefined) updateData.commission = data.commission.toString();
        if (data.deliveryAddress) updateData.deliveryAddress = data.deliveryAddress;
        if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;
        if (data.deliveryTimeSlot !== undefined) updateData.deliveryTimeSlot = data.deliveryTimeSlot || null;
        if (data.trackingNumber !== undefined) updateData.trackingNumber = data.trackingNumber || null;
        if (data.notes !== undefined) updateData.notes = data.notes || null;

        await updateOrder(id, updateData as any);

        // 更新產品明細（如果有提供）
        if (products !== undefined || gifts !== undefined) {
          // 獲取舊的產品明細以恢復庫存
          const oldProducts = await getOrderProducts(id);
          for (const p of oldProducts) {
            await updateProductStockBySku(p.sku, p.quantity);
          }

          // 刪除舊的產品明細
          await deleteOrderProducts(id);

          // 新增新的產品明細
          const allProducts = [
            ...(products || []).map(p => ({ ...p, isGift: false })),
            ...(gifts || []).map(g => ({ ...g, isGift: true })),
          ];

          if (allProducts.length > 0) {
            await addOrderProducts(id, allProducts.map(p => ({
              sku: p.sku,
              productName: p.productName,
              color: p.color || null,
              quantity: p.quantity,
              unitPrice: (p.unitPrice !== undefined && p.unitPrice !== null) ? p.unitPrice.toString() : "0",
              isGift: p.isGift ? "yes" : "no",
            })));

            // 扣除香港庫存
            for (const product of allProducts) {
              await updateProductStockBySku(product.sku, -product.quantity);
            }
          }
        }

        return { success: true };
      }),

    getProducts: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return getOrderProducts(input.orderId);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "confirmed", "delivering", "completed", "cancelled"]),
      }))
      .mutation(async ({ input }) => {
        const order = await getOrderById(input.id);
        if (!order) throw new Error("訂單不存在");

        await updateOrderStatus(input.id, input.status);

        // 發送狀態變更通知
        const statusLabel = ORDER_STATUS[input.status].label;
        await notifyOwner({
          title: `訂單狀態更新 ${order.orderNumber}`,
          content: `訂單 ${order.orderNumber} 狀態已更新為：${statusLabel}\n客戶：${order.customerName}`,
        });

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 獲取訂單產品明細以恢復庫存
        const orderProductsList = await getOrderProducts(input.id);
        
        // 恢復香港庫存
        for (const product of orderProductsList) {
          await updateProductStockBySku(product.sku, product.quantity);
        }

        // 恢復商鋪庫存
        const order = await getOrderById(input.id);
        if (order) {
          const matchedShop = await getShopByName(order.shopName);
          if (matchedShop) {
            for (const product of orderProductsList) {
              const dbProduct = await getProductBySku(product.sku);
              if (dbProduct) {
                const newQty = await adjustShopInventory(dbProduct.id, matchedShop.id, product.quantity);
                await createInventoryLog({
                  productId: dbProduct.id,
                  shopId: matchedShop.id,
                  quantityChange: product.quantity,
                  quantityAfter: newQty,
                  changeType: 'order_cancel',
                  referenceId: input.id,
                  referenceType: 'order',
                  notes: `訂單 ${order.orderNumber} 刪除恢復庫存`,
                  createdBy: ctx.user?.id,
                });
              }
            }
          }
        }
        
        // 刪除訂單產品明細
        await deleteOrderProducts(input.id);
        
        // 刪除訂單
        await deleteOrder(input.id);
        return { success: true };
      }),

    export: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        status: z.string().optional(),
        packageId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const filters = input ? {
          search: input.search,
          status: input.status,
          packageId: input.packageId,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        } : undefined;

        const orders = await getOrdersForExport(filters);
        
        // 獲取每個訂單的產品明細
        const ordersWithProducts = await Promise.all(
          orders.map(async (order) => {
            const orderProductsList = await getOrderProducts(order.id);
            
            // 獲取產品詳細資訊，優先使用 orderProducts 表格中的資料
            const productsWithDetails = await Promise.all(
              orderProductsList.map(async (op) => {
                const product = op.productId ? await getProductById(op.productId) : null;
                return {
                  // 優先使用 orderProducts 表格中儲存的資料
                  sku: op.sku || product?.sku || '',
                  name: op.productName || product?.name || '',
                  color: op.color || product?.color || '',
                  quantity: op.quantity,
                  unitPrice: Number(op.unitPrice || 0),
                  isGift: op.isGift === 'yes',
                };
              })
            );
            
            // 分類產品和贈品
            const products = productsWithDetails.filter(p => !p.isGift);
            const gifts = productsWithDetails.filter(p => p.isGift);
            
            // 格式化產品明細字串（包含單價）
            const productDetails = products.map(p => {
              const priceStr = p.unitPrice > 0 ? ` @$${p.unitPrice}` : '';
              return `${p.sku} | ${p.name} (${p.color}) x${p.quantity}${priceStr}`;
            }).join('\n');
            const giftDetails = gifts.map(g => `${g.sku} | ${g.name} (${g.color}) x${g.quantity}`).join('\n');
            
            return {
              ...order,
              productDetails,
              giftDetails,
            };
          })
        );
        
        return ordersWithProducts.map(order => ({
          訂單編號: order.orderNumber,
          商鋪: (order as any).shopName || "ReadyGo HK",
          客戶姓名: order.customerName,
          聯絡電話: order.customerPhone,
          電子郵件: order.customerEmail || "",
          套餐名稱: order.packageName,
          套餐變體: order.packageVariant || "",
          產品明細: order.productDetails || "",
          贈品明細: order.giftDetails || "",
          訂單金額: Number(order.orderAmount),
          佣金: Number(order.commission),
          送貨地址: order.deliveryAddress,
          送貨日期: order.deliveryDate ? formatDateYYYYMMDD(new Date(order.deliveryDate)) : "",
          送貨時段: order.deliveryTimeSlot || "",
          快遞號: order.trackingNumber || "",
          訂單狀態: ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.label || order.status,
          備註: order.notes || "",
          建立時間: new Date(order.createdAt).toLocaleString("zh-TW"),
        }));
      }),

    recent: protectedProcedure
      .input(z.object({ limit: z.number().default(10) }).optional())
      .query(async ({ input }) => {
        return getRecentOrders(input?.limit || 10);
      }),
  }),

  // 統計相關
  stats: router({
    overview: protectedProcedure.query(async () => {
      return getOrderStats();
    }),
    byDateRange: protectedProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getOrderStatsByDateRange(input.dateFrom, input.dateTo);
      }),
  }),

  // 產品管理
  products: router({
    list: protectedProcedure.query(async () => {
      return getAllProducts();
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getProductById(input.id);
      }),

    getBySku: protectedProcedure
      .input(z.object({ sku: z.string() }))
      .query(async ({ input }) => {
        return getProductBySku(input.sku);
      }),

    create: protectedProcedure
      .input(z.object({
        sku: z.string().min(1, "請輸入 SKU"),
        name: z.string().min(1, "請輸入產品名稱"),
        color: z.string().optional(),
        price: z.number().nonnegative().optional(),
        stockHK: z.number().optional(),
        stockCN: z.number().optional(),
        isGift: z.enum(["yes", "no"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await getProductBySku(input.sku);
        if (existing) {
          throw new Error("SKU 已存在");
        }

        const id = await createProduct({
          sku: input.sku,
          name: input.name,
          color: input.color || null,
          price: input.price?.toString() || "0",
          stockHK: input.stockHK || 0,
          stockCN: input.stockCN || 0,
          isGift: input.isGift || "no",
          isActive: "yes",
        });

        return { id, sku: input.sku };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        sku: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        price: z.number().nonnegative().optional(),
        stockHK: z.number().optional(),
        stockCN: z.number().optional(),
        isGift: z.enum(["yes", "no"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};

        if (data.sku) {
          // 檢查新 SKU 是否與其他產品衝突
          const existing = await getProductBySku(data.sku);
          if (existing && existing.id !== id) {
            throw new Error("SKU 已存在");
          }
          updateData.sku = data.sku;
        }
        if (data.name) updateData.name = data.name;
        if (data.color !== undefined) updateData.color = data.color || null;
        if (data.price !== undefined) updateData.price = data.price.toString();
        if (data.stockHK !== undefined) updateData.stockHK = data.stockHK;
        if (data.stockCN !== undefined) updateData.stockCN = data.stockCN;
        if (data.isGift !== undefined) updateData.isGift = data.isGift;

        await updateProduct(id, updateData as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteProduct(input.id);
        return { success: true };
      }),
  }),

  // AI 分析
  ai: router({
    analyze: protectedProcedure
      .input(z.object({
        type: z.enum(["trend", "recommendation"]),
      }))
      .mutation(async ({ input }) => {
        const stats = await getOrderStats();
        const recentOrders = await getRecentOrders(50);

        const orderSummary = recentOrders.map(o => ({
          date: new Date(o.createdAt).toLocaleDateString("zh-TW"),
          package: o.packageName,
          amount: Number(o.orderAmount),
          status: o.status,
        }));

        const prompt = input.type === "trend"
          ? `作為銷售分析師，請根據以下訂單數據分析銷售趨勢：

總訂單數：${stats.totalOrders}
總銷售額：$${stats.totalSales}
總佣金：$${stats.totalCommission}
待處理訂單：${stats.pendingOrders}
已完成訂單：${stats.completedOrders}

各套餐銷量：
${stats.packageStats.map(p => `- ${p.packageName}: ${p.count}單, $${p.sales}`).join("\n")}

最近訂單：
${JSON.stringify(orderSummary.slice(0, 20), null, 2)}

請提供：
1. 銷售趨勢分析
2. 熱門套餐分析
3. 改進建議`
          : `作為銷售顧問，請根據以下數據提供套餐推薦建議：

各套餐銷量：
${stats.packageStats.map(p => `- ${p.packageName}: ${p.count}單, $${p.sales}`).join("\n")}

總銷售額：$${stats.totalSales}
總訂單數：${stats.totalOrders}

請提供：
1. 最受歡迎的套餐分析
2. 潛力套餐推薦
3. 促銷策略建議`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一位專業的銷售數據分析師，請用繁體中文回答。" },
            { role: "user", content: prompt },
          ],
        });

        return {
          analysis: response.choices[0]?.message?.content || "分析失敗",
          type: input.type,
        };
      }),
  }),

  // 月份送貨報表
  reports: router({
    monthlyDelivery: protectedProcedure
      .input(z.object({
        year: z.number().min(2020).max(2100),
      }))
      .query(async ({ input }) => {
        return getMonthlyDeliveryReport(input.year);
      }),
  }),

  // 顧客管理
  customers: router({
    list: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        return getCustomers(input?.search, input?.limit || 50, input?.offset || 0);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const customer = await getCustomerById(input.id);
        if (!customer) return null;
        
        // 獲取顧客的訂單歷史
        const orders = await getOrdersByCustomerId(input.id);
        
        return {
          ...customer,
          orders,
        };
      }),

    getByPhone: protectedProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getCustomerByPhone(input.phone);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")),
        address: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 檢查電話是否已存在
        const existing = await getCustomerByPhone(input.phone);
        if (existing) {
          throw new Error("該電話號碼已存在顧客記錄");
        }
        
        const customerId = await createCustomer({
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          address: input.address || null,
          notes: input.notes || null,
        });
        
        return { id: customerId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
        email: z.string().email().optional().or(z.literal("")),
        address: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        if (data.phone) {
          // 檢查新電話是否與其他顧客衝突
          const existing = await getCustomerByPhone(data.phone);
          if (existing && existing.id !== id) {
            throw new Error("該電話號碼已存在其他顧客記錄");
          }
          updateData.phone = data.phone;
        }
        
        if (data.name) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email || null;
        if (data.address !== undefined) updateData.address = data.address || null;
        if (data.notes !== undefined) updateData.notes = data.notes || null;
        
        await updateCustomer(id, updateData as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomer(input.id);
        return { success: true };
      }),
  }),

  // 付款管理
  payments: router({
    listByOrder: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return getPaymentsByOrderId(input.orderId);
      }),

    // 上傳付款證明圖片
    uploadProofImage: protectedProcedure
      .input(z.object({
        filename: z.string(),
        data: z.string(), // Base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.data, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `payment-proofs/${Date.now()}-${randomSuffix}-${input.filename}`;
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url };
      }),

    create: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        paymentMethod: z.enum(["stripe", "cash", "bank_transfer", "other"]),
        amount: z.number().positive(),
        notes: z.string().optional(),
        proofImageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const paymentId = await createPayment({
          orderId: input.orderId,
          paymentMethod: input.paymentMethod,
          amount: input.amount.toString(),
          status: "completed",
          paidAt: new Date(),
          notes: input.notes || null,
          proofImageUrl: input.proofImageUrl || null,
        });
        
        // 更新訂單付款狀態
        await updateOrderPaymentStatus(input.orderId);
        
        // 如果訂單有關聯顧客，更新顧客統計
        const order = await getOrderById(input.orderId);
        if (order?.customerId) {
          await updateCustomerStats(order.customerId);
        }
        
        return { id: paymentId };
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "completed", "failed", "refunded"]),
      }))
      .mutation(async ({ input }) => {
        await updatePayment(input.id, {
          status: input.status,
          paidAt: input.status === "completed" ? new Date() : undefined,
        });
        
        // 獲取付款記錄以更新訂單狀態
        const payments = await getPaymentsByOrderId(input.id);
        if (payments.length > 0) {
          await updateOrderPaymentStatus(payments[0].orderId);
        }
        
        return { success: true };
      }),

    // 生成 PDF 文件
    generatePdf: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        type: z.enum(["quotation", "invoice", "receipt"]),
      }))
      .mutation(async ({ input }) => {
        const order = await getOrderById(input.orderId);
        if (!order) {
          throw new Error("訂單不存在");
        }
        
        // 獲取訂單產品明細
        const orderProductsList = await getOrderProducts(input.orderId);
        
        // 獲取產品詳細資訊
        const productsWithDetails = await Promise.all(
          orderProductsList.map(async (op) => {
            const product = op.productId ? await getProductById(op.productId) : null;
            // 優先使用 orderProducts 表中記錄的單價，其次使用產品表的單價
            const unitPrice = Number(op.unitPrice || 0) || (product ? Number(product.price || 0) : 0);
            return {
              sku: op.sku || product?.sku || "",
              name: op.productName || product?.name || "",
              color: op.color || product?.color || "",
              quantity: op.quantity,
              unitPrice,
              isGift: op.isGift === "yes",
            };
          })
        );
        
        const products = productsWithDetails.filter(p => !p.isGift);
        const gifts = productsWithDetails.filter(p => p.isGift);
        
        const orderForPdf: OrderForPdf = {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail,
          deliveryAddress: order.deliveryAddress,
          deliveryDate: order.deliveryDate,
          deliveryTimeSlot: order.deliveryTimeSlot,
          orderAmount: order.orderAmount,
          paidAmount: order.paidAmount,
          paymentStatus: order.paymentStatus,
          shopName: order.shopName || "ReadyGo HK",
          packageName: order.packageName,
          packageVariant: order.packageVariant,
          products,
          gifts,
          createdAt: order.createdAt,
          notes: order.notes,
        };
        
        let pdfBuffer: Buffer;
        let filename: string;
        
        switch (input.type) {
          case "quotation":
            pdfBuffer = await generateQuotationPdf(orderForPdf);
            filename = `報價單_${order.orderNumber}.pdf`;
            break;
          case "invoice":
            pdfBuffer = await generateInvoicePdf(orderForPdf);
            filename = `發票_${order.orderNumber}.pdf`;
            break;
          case "receipt":
            pdfBuffer = await generateReceiptPdf(orderForPdf);
            filename = `收據_${order.orderNumber}.pdf`;
            break;
        }
        
        // 返回 Base64 編碼的 PDF
        return {
          data: pdfBuffer.toString("base64"),
          filename,
          contentType: "application/pdf",
        };
      }),

    // 建立 Stripe 付款連結
    createStripeLink: protectedProcedure
      .input(z.object({
        orderId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await getOrderById(input.orderId);
        if (!order) {
          throw new Error("訂單不存在");
        }
        
        // 建立 Stripe Checkout Session
        const { createPaymentLink } = await import("./stripe");
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        
        const result = await createPaymentLink({
          orderId: order.id,
          orderNumber: order.orderNumber,
          amount: Number(order.orderAmount),
          customerName: order.customerName,
          customerEmail: order.customerEmail || undefined,
          description: `訂單 ${order.orderNumber} - ${order.packageName}`,
          successUrl: `${origin}/orders/${order.id}?payment=success`,
          cancelUrl: `${origin}/orders/${order.id}?payment=cancelled`,
        });
        
        return {
          url: result.url,
          sessionId: result.sessionId,
        };
      }),
  }),

  // 商鋪管理
  shops: router({
    list: protectedProcedure.query(async () => {
      return getAllShops();
    }),

    listAll: protectedProcedure.query(async () => {
      return getAllShops(true);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "請輸入商鋪名稱"),
        phone: z.string().optional(),
        address: z.string().optional(),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const existing = await getShopByName(input.name);
        if (existing) {
          throw new Error("商鋪名稱已存在");
        }
        const id = await createShop({
          name: input.name,
          phone: input.phone || null,
          address: input.address || null,
          sortOrder: input.sortOrder,
          isActive: "yes",
        });
        return { id, name: input.name };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.enum(["yes", "no"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.name) {
          const existing = await getShopByName(data.name);
          if (existing && existing.id !== id) {
            throw new Error("商鋪名稱已存在");
          }
        }
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.phone !== undefined) updateData.phone = data.phone || null;
        if (data.address !== undefined) updateData.address = data.address || null;
        if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;
        await updateShop(id, updateData as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteShop(input.id);
        return { success: true };
      }),
  }),

  // 庫存管理
  inventory: router({
    // 取得所有商鋪庫存
    all: protectedProcedure.query(async () => {
      return getAllShopInventory();
    }),

    // 取得某間商鋪的庫存
    byShop: protectedProcedure
      .input(z.object({ shopId: z.number() }))
      .query(async ({ input }) => {
        return getShopInventory(input.shopId);
      }),

    // 取得某個產品在各商鋪的庫存
    byProduct: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return getShopInventoryByProduct(input.productId);
      }),

    // 調整庫存（允許正數和負數）
    adjust: protectedProcedure
      .input(z.object({
        productId: z.number(),
        shopId: z.number(),
        quantityChange: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const newQty = await adjustShopInventory(input.productId, input.shopId, input.quantityChange);
        
        // 記錄庫存變動
        await createInventoryLog({
          productId: input.productId,
          shopId: input.shopId,
          quantityChange: input.quantityChange,
          quantityAfter: newQty,
          changeType: 'manual',
          notes: input.notes || null,
          createdBy: ctx.user.id,
        });
        
        return { success: true, newQuantity: newQty };
      }),

    // 設定庫存（直接設定數量）
    set: protectedProcedure
      .input(z.object({
        productId: z.number(),
        shopId: z.number(),
        quantity: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await getShopInventoryItem(input.productId, input.shopId);
        const oldQty = existing?.quantity || 0;
        const change = input.quantity - oldQty;
        
        await upsertShopInventory(input.productId, input.shopId, input.quantity);
        
        // 記錄庫存變動
        await createInventoryLog({
          productId: input.productId,
          shopId: input.shopId,
          quantityChange: change,
          quantityAfter: input.quantity,
          changeType: 'manual',
          notes: input.notes || `庫存設定為 ${input.quantity}`,
          createdBy: ctx.user.id,
        });
        
        return { success: true };
      }),

    // 庫存變動記錄
    logs: protectedProcedure
      .input(z.object({
        productId: z.number().optional(),
        shopId: z.number().optional(),
        changeType: z.string().optional(),
        limit: z.number().default(100),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        return getInventoryLogs({
          productId: input?.productId,
          shopId: input?.shopId,
          changeType: input?.changeType,
          limit: input?.limit || 100,
          offset: input?.offset || 0,
        });
      }),
  }),

  // 採購訂單管理
  purchaseOrders: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        shopId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        return getPurchaseOrders({
          status: input?.status,
          shopId: input?.shopId,
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const po = await getPurchaseOrderById(input.id);
        if (!po) return null;
        
        const items = await getPurchaseOrderItems(input.id);
        const shop = await getShopById(po.shopId);
        
        return {
          ...po,
          shopName: shop?.name || '未知商鋪',
          items,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        supplier: z.string().min(1, "請輸入供應商名稱"),
        shopId: z.number(),
        orderDate: z.string(),
        notes: z.string().optional(),
        pdfUrl: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          sku: z.string(),
          productName: z.string(),
          color: z.string().optional(),
          quantity: z.number().positive(),
          unitCost: z.number().nonnegative(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        // 計算總金額
        const totalAmount = input.items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
        
        const result = await createPurchaseOrder({
          supplier: input.supplier,
          shopId: input.shopId,
          orderDate: new Date(input.orderDate),
          status: 'draft',
          pdfUrl: input.pdfUrl || null,
          totalAmount: totalAmount.toString(),
          notes: input.notes || null,
          createdBy: ctx.user.id,
        });
        
        // 新增採購明細
        await addPurchaseOrderItems(result.id, input.items.map(item => ({
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          color: item.color || null,
          quantity: item.quantity,
          unitCost: item.unitCost.toString(),
        })));
        
        return result;
      }),

    // 更新採購單狀態
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["draft", "ordered", "received", "cancelled"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const po = await getPurchaseOrderById(input.id);
        if (!po) throw new Error("採購單不存在");
        
        // 當狀態變為 "received" 時，自動增加庫存
        if (input.status === 'received' && po.status !== 'received') {
          const items = await getPurchaseOrderItems(input.id);
          
          for (const item of items) {
            const newQty = await adjustShopInventory(item.productId, po.shopId, item.quantity);
            
            // 記錄庫存變動
            await createInventoryLog({
              productId: item.productId,
              shopId: po.shopId,
              quantityChange: item.quantity,
              quantityAfter: newQty,
              changeType: 'purchase',
              referenceId: input.id,
              referenceType: 'purchaseOrder',
              notes: `採購入庫 - ${po.poNumber}`,
              createdBy: ctx.user.id,
            });
          }
        }
        
        await updatePurchaseOrder(input.id, { status: input.status });
        return { success: true };
      }),

    // 上傳採購單 PDF
    uploadPdf: protectedProcedure
      .input(z.object({
        filename: z.string(),
        data: z.string(), // Base64 encoded
        contentType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        const buffer = Buffer.from(input.data, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `purchase-orders/${Date.now()}-${randomSuffix}-${input.filename}`;
        const { url } = await storagePut(fileKey, buffer, input.contentType);
        return { url };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const po = await getPurchaseOrderById(input.id);
        if (!po) throw new Error("採購單不存在");
        if (po.status === 'received') {
          throw new Error("已收貨的採購單不可刪除");
        }
        await deletePurchaseOrder(input.id);
        return { success: true };
      }),
  }),

  // 庫存調撥管理
  stockTransfers: router({
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        fromShopId: z.number().optional(),
        toShopId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        return getStockTransfers({
          status: input?.status,
          fromShopId: input?.fromShopId,
          toShopId: input?.toShopId,
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const transfer = await getStockTransferById(input.id);
        if (!transfer) return null;
        
        const items = await getStockTransferItems(input.id);
        const fromShop = await getShopById(transfer.fromShopId);
        const toShop = await getShopById(transfer.toShopId);
        
        return {
          ...transfer,
          fromShopName: fromShop?.name || '未知商鋪',
          toShopName: toShop?.name || '未知商鋪',
          items,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        fromShopId: z.number(),
        toShopId: z.number(),
        notes: z.string().optional(),
        items: z.array(z.object({
          productId: z.number(),
          sku: z.string(),
          productName: z.string(),
          color: z.string().optional(),
          quantity: z.number().positive(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.fromShopId === input.toShopId) {
          throw new Error("來源商鋪和目標商鋪不能相同");
        }
        
        const result = await createStockTransfer({
          fromShopId: input.fromShopId,
          toShopId: input.toShopId,
          status: 'pending',
          notes: input.notes || null,
          createdBy: ctx.user.id,
        });
        
        // 新增調撥明細
        await addStockTransferItems(result.id, input.items.map(item => ({
          productId: item.productId,
          sku: item.sku,
          productName: item.productName,
          color: item.color || null,
          quantity: item.quantity,
        })));
        
        return result;
      }),

    // 確認調撥（執行庫存轉移）
    confirm: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const transfer = await getStockTransferById(input.id);
        if (!transfer) throw new Error("調撥單不存在");
        if (transfer.status !== 'pending') throw new Error("只有待確認的調撥單可以執行");
        
        const items = await getStockTransferItems(input.id);
        
        for (const item of items) {
          // 從來源商鋪扣減
          const fromNewQty = await adjustShopInventory(item.productId, transfer.fromShopId, -item.quantity);
          await createInventoryLog({
            productId: item.productId,
            shopId: transfer.fromShopId,
            quantityChange: -item.quantity,
            quantityAfter: fromNewQty,
            changeType: 'transfer_out',
            referenceId: input.id,
            referenceType: 'stockTransfer',
            notes: `調撥出庫 - ${transfer.transferNumber}`,
            createdBy: ctx.user.id,
          });
          
          // 到目標商鋪增加
          const toNewQty = await adjustShopInventory(item.productId, transfer.toShopId, item.quantity);
          await createInventoryLog({
            productId: item.productId,
            shopId: transfer.toShopId,
            quantityChange: item.quantity,
            quantityAfter: toNewQty,
            changeType: 'transfer_in',
            referenceId: input.id,
            referenceType: 'stockTransfer',
            notes: `調撥入庫 - ${transfer.transferNumber}`,
            createdBy: ctx.user.id,
          });
        }
        
        await updateStockTransfer(input.id, { status: 'completed' });
        return { success: true };
      }),

    // 取消調撥
    cancel: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const transfer = await getStockTransferById(input.id);
        if (!transfer) throw new Error("調撥單不存在");
        if (transfer.status !== 'pending') throw new Error("只有待確認的調撥單可以取消");
        
        await updateStockTransfer(input.id, { status: 'cancelled' });
        return { success: true };
      }),

    // 生成調撥單 PDF
    generatePdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const transfer = await getStockTransferById(input.id);
        if (!transfer) throw new Error("調撥單不存在");

        const items = await getStockTransferItems(input.id);
        const fromShop = await getShopById(transfer.fromShopId);
        const toShop = await getShopById(transfer.toShopId);

        const transferForPdf: TransferForPdf = {
          transferNumber: transfer.transferNumber,
          fromShopName: fromShop?.name || '未知商鋪',
          fromShopPhone: fromShop?.phone || null,
          fromShopAddress: fromShop?.address || null,
          toShopName: toShop?.name || '未知商鋪',
          toShopPhone: toShop?.phone || null,
          toShopAddress: toShop?.address || null,
          status: transfer.status,
          notes: transfer.notes,
          createdAt: transfer.createdAt,
          items: items.map(item => ({
            sku: item.sku,
            productName: item.productName,
            color: item.color,
            quantity: item.quantity,
          })),
        };

        const pdfBuffer = await generateTransferPdf(transferForPdf);
        const filename = `調撥單_${transfer.transferNumber}.pdf`;

        return {
          data: pdfBuffer.toString('base64'),
          filename,
          contentType: 'application/pdf',
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
