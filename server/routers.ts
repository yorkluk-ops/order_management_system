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
} from "./db";
import { PACKAGE_DEFINITIONS, ORDER_STATUS, getAllPackagesFlat } from "../shared/packages";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";

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

  // 套餐相關
  packages: router({
    list: publicProcedure.query(() => {
      return PACKAGE_DEFINITIONS;
    }),
    listFlat: publicProcedure.query(() => {
      return getAllPackagesFlat();
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
        packageName: z.string().min(1),
        packageVariant: z.string().optional(),
        orderAmount: z.number().positive(),
        commission: z.number().nonnegative(),
        deliveryAddress: z.string().min(1, "請輸入送貨地址"),
        deliveryDate: z.string().optional(),
        deliveryTimeSlot: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createOrder({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail || null,
          packageId: 1,
          packageName: input.packageName,
          packageVariant: input.packageVariant || null,
          orderAmount: input.orderAmount.toString(),
          commission: input.commission.toString(),
          deliveryAddress: input.deliveryAddress,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : null,
          deliveryTimeSlot: input.deliveryTimeSlot || null,
          notes: input.notes || null,
          status: "pending",
          createdBy: ctx.user.id,
        });

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
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      }).optional())
      .query(async ({ input }) => {
        const filters = input ? {
          search: input.search,
          status: input.status,
          packageId: input.packageId,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        } : undefined;

        return getOrders(filters, input?.limit || 20, input?.offset || 0);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getOrderById(input.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        customerName: z.string().min(1).optional(),
        customerPhone: z.string().min(1).optional(),
        customerEmail: z.string().email().optional().or(z.literal("")),
        packageName: z.string().optional(),
        packageVariant: z.string().optional(),
        orderAmount: z.number().positive().optional(),
        commission: z.number().nonnegative().optional(),
        deliveryAddress: z.string().optional(),
        deliveryDate: z.string().optional(),
        deliveryTimeSlot: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};

        if (data.customerName) updateData.customerName = data.customerName;
        if (data.customerPhone) updateData.customerPhone = data.customerPhone;
        if (data.customerEmail !== undefined) updateData.customerEmail = data.customerEmail || null;
        if (data.packageName) updateData.packageName = data.packageName;
        if (data.packageVariant !== undefined) updateData.packageVariant = data.packageVariant || null;
        if (data.orderAmount) updateData.orderAmount = data.orderAmount.toString();
        if (data.commission !== undefined) updateData.commission = data.commission.toString();
        if (data.deliveryAddress) updateData.deliveryAddress = data.deliveryAddress;
        if (data.deliveryDate !== undefined) updateData.deliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : null;
        if (data.deliveryTimeSlot !== undefined) updateData.deliveryTimeSlot = data.deliveryTimeSlot || null;
        if (data.notes !== undefined) updateData.notes = data.notes || null;

        await updateOrder(id, updateData as any);
        return { success: true };
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
      .mutation(async ({ input }) => {
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
        return orders.map(order => ({
          訂單編號: order.orderNumber,
          客戶姓名: order.customerName,
          聯絡電話: order.customerPhone,
          電子郵件: order.customerEmail || "",
          套餐名稱: order.packageName,
          套餐變體: order.packageVariant || "",
          訂單金額: Number(order.orderAmount),
          佣金: Number(order.commission),
          送貨地址: order.deliveryAddress,
          送貨日期: order.deliveryDate ? formatDateYYYYMMDD(new Date(order.deliveryDate)) : "",
          送貨時段: order.deliveryTimeSlot || "",
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
      }))
      .mutation(async ({ input }) => {
        // 檢查 SKU 是否已存在
        const existing = await getProductBySku(input.sku);
        if (existing) {
          throw new Error("SKU 已存在");
        }

        const id = await createProduct({
          sku: input.sku,
          name: input.name,
          color: input.color || null,
          price: input.price?.toString() || "0",
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
});

export type AppRouter = typeof appRouter;
