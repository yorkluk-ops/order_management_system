import { ORDER_STATUS } from "../shared/packages";
import type { Order } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import {
  addOrderProducts,
  adjustShopInventory,
  createInventoryLog,
  createOrder,
  getOrderById,
  getOrderProducts,
  getProductBySku,
  getShopByName,
  getShopInventoryItem,
  updateOrderStatus,
  updateProductStock,
  updateProductStockBySku,
} from "./db";

/** Warehouse deducted only when an order moves to delivering. Distinct from the Boutir retail shop. */
export const ULTRON_SHOP_NAME = "奧創數碼有限公司";

export type OrderLineInput = {
  sku: string;
  productName: string;
  color?: string | null;
  quantity: number;
  unitPrice?: number | null;
  isGift?: boolean;
};

export type CreateOrderWithStockInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  packageName?: string;
  packageVariant?: string | null;
  shopName?: string;
  orderAmount: number;
  commission: number;
  deliveryAddress: string;
  deliveryDate?: string | null;
  deliveryTimeSlot?: string | null;
  notes?: string | null;
  products?: OrderLineInput[];
  gifts?: OrderLineInput[];
  packageGiftProductIds?: number[];
  createdBy?: number | null;
  /**
   * UI order create notifies the owner. Import sets this false so a missing
   * notification service cannot fail an order that already deducted stock.
   */
  notify?: boolean;
};

export type StockCheckLine = {
  sku: string;
  productName: string;
  quantity: number;
  isGift?: boolean | "yes" | "no";
};

export type UltronShortage = {
  productName: string;
  sku: string;
  required: number;
  available: number;
};

/**
 * Same Ultron check used before delivering: gifts are ignored, unknown SKUs are
 * skipped, and a missing warehouse shop does not block (nothing to deduct).
 */
export async function findUltronDeliveryShortages(lines: StockCheckLine[]): Promise<{
  shopMissing: boolean;
  shortages: UltronShortage[];
}> {
  const ultronShop = await getShopByName(ULTRON_SHOP_NAME);
  if (!ultronShop) return { shopMissing: true, shortages: [] };

  const shortages: UltronShortage[] = [];
  for (const product of lines) {
    if (product.isGift === true || product.isGift === "yes") continue;
    const dbProduct = await getProductBySku(product.sku);
    if (!dbProduct) continue;
    const inv = await getShopInventoryItem(dbProduct.id, ultronShop.id);
    const available = inv?.quantity ?? 0;
    if (available < product.quantity) {
      shortages.push({
        productName: product.productName,
        sku: product.sku,
        required: product.quantity,
        available,
      });
    }
  }
  return { shopMissing: false, shortages };
}

export function formatUltronShortageMessage(shortages: UltronShortage[]): string {
  const lines = shortages.map(
    (item) => `${item.productName}（庫存: ${item.available}，需要: ${item.required}）`,
  );
  return `庫存不足，無法轉為配送中\n\n${lines.join("\n")}`;
}

/**
 * OMS order create: insert the order, store lines, deduct Hong Kong product stock
 * and the named shop's inventory. Both stock buckets may go negative, matching
 * the existing order form. Ultron warehouse stock is not touched here.
 */
export async function createOrderWithStockDeduction(
  input: CreateOrderWithStockInput,
): Promise<{ id: number; orderNumber: string }> {
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
    createdBy: input.createdBy ?? null,
  });

  const allProducts = [
    ...(input.products || []).map((product) => ({ ...product, isGift: false })),
    ...(input.gifts || []).map((gift) => ({ ...gift, isGift: true })),
  ];

  if (allProducts.length > 0) {
    await addOrderProducts(result.id, allProducts.map((product) => ({
      sku: product.sku,
      productName: product.productName,
      color: product.color || null,
      quantity: product.quantity,
      unitPrice: (product.unitPrice !== undefined && product.unitPrice !== null)
        ? product.unitPrice.toString()
        : "0",
      isGift: product.isGift ? "yes" as const : "no" as const,
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
            changeType: "order",
            referenceId: result.id,
            referenceType: "order",
            notes: `訂單 ${result.orderNumber} 銷售扣減`,
            createdBy: input.createdBy ?? undefined,
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
      if (matchedShop) {
        const newQty = await adjustShopInventory(productId, matchedShop.id, -1);
        await createInventoryLog({
          productId,
          shopId: matchedShop.id,
          quantityChange: -1,
          quantityAfter: newQty,
          changeType: "order",
          referenceId: result.id,
          referenceType: "order",
          notes: `訂單 ${result.orderNumber} 套餐贈品扣減`,
          createdBy: input.createdBy ?? undefined,
        });
      }
    }
  }

  if (input.notify !== false) {
    await notifyOwner({
      title: `新訂單 ${result.orderNumber}`,
      content: `客戶：${input.customerName}\n套餐：${input.packageName}\n金額：$${input.orderAmount}\n送貨地址：${input.deliveryAddress}`,
    });
  }

  return result;
}

/**
 * Status change used by the order screen. Moving to delivering deducts the
 * Ultron warehouse and rejects when that warehouse is short. Leaving delivering
 * for pending/confirmed restores it. Other transitions do not move stock.
 */
export async function applyOrderStatusTransition(input: {
  id: number;
  status: Order["status"];
  createdBy?: number | null;
  notify?: boolean;
}): Promise<{ success: true }> {
  const order = await getOrderById(input.id);
  if (!order) throw new Error("訂單不存在");

  const prevStatus = order.status;
  const newStatus = input.status;

  await updateOrderStatus(input.id, newStatus);

  const isGoingToDelivering = newStatus === "delivering" && prevStatus !== "delivering";
  const isRevertFromDelivering = prevStatus === "delivering" && (newStatus === "pending" || newStatus === "confirmed");

  if (isGoingToDelivering || isRevertFromDelivering) {
    const ultronShop = await getShopByName(ULTRON_SHOP_NAME);
    if (ultronShop) {
      const orderProductsList = await getOrderProducts(input.id);

      if (isGoingToDelivering) {
        const { shortages } = await findUltronDeliveryShortages(orderProductsList);
        if (shortages.length > 0) {
          await updateOrderStatus(input.id, prevStatus);
          throw new Error(formatUltronShortageMessage(shortages));
        }
      }

      for (const product of orderProductsList) {
        if (product.isGift === "yes") continue;
        const dbProduct = await getProductBySku(product.sku);
        if (!dbProduct) continue;

        const qtyChange = isGoingToDelivering ? -product.quantity : product.quantity;
        const newQty = await adjustShopInventory(dbProduct.id, ultronShop.id, qtyChange);

        await createInventoryLog({
          productId: dbProduct.id,
          shopId: ultronShop.id,
          quantityChange: qtyChange,
          quantityAfter: newQty,
          changeType: isGoingToDelivering ? "order" : "order_cancel",
          referenceId: input.id,
          referenceType: "order",
          notes: isGoingToDelivering
            ? `訂單 ${order.orderNumber} 配送中 — 奧創出貨`
            : `訂單 ${order.orderNumber} 撤回配送 — 恢復奧創庫存`,
          createdBy: input.createdBy ?? undefined,
        });
      }
    }
  }

  if (input.notify !== false) {
    const statusLabel = ORDER_STATUS[newStatus].label;
    await notifyOwner({
      title: `訂單狀態更新 ${order.orderNumber}`,
      content: `訂單 ${order.orderNumber} 狀態已更新為：${statusLabel}\n客戶：${order.customerName}`,
    });
  }

  return { success: true };
}
