import { createHash, timingSafeEqual } from "crypto";
import type { Express, Request, Response } from "express";
import { z, ZodError } from "zod";
import type { Order, Shop } from "../drizzle/schema";
import {
  claimExternalOrderImport,
  completeExternalOrderImport,
  createShop,
  getAllShops,
  getExternalOrderImport,
  getOrderById,
  getProductById,
  getProductBySku,
  getShopById,
  getShopByName,
  isDuplicateKeyError,
  releaseExternalOrderImport,
  updateOrder,
} from "./db";
import {
  applyOrderStatusTransition,
  createOrderWithStockDeduction,
  findUltronDeliveryShortages,
  ULTRON_SHOP_NAME,
} from "./orderFulfillment";

export const MAX_IMPORT_BATCH = 20;

const MISSING_CONTACT = "未提供";

/**
 * Canonical shop names. Looked up by name and created when missing.
 * Ids are never hardcoded.
 *
 * Boutir retail is "奧創數碼", which is not the warehouse
 * "奧創數碼有限公司" (that warehouse is deducted only when status becomes delivering).
 */
const SHOP_ALIASES: Record<string, string> = {
  "readygo": "ReadyGo HK",
  "ready go": "ReadyGo HK",
  "readygo hk": "ReadyGo HK",
  "ready go hk": "ReadyGo HK",
  "hktvmall": "Ready Go HKTVMALL",
  "hktv": "Ready Go HKTVMALL",
  "ready go hktvmall": "Ready Go HKTVMALL",
  "shnuggle": "Shnuggle",
  "奧創數碼": "奧創數碼",
  "upang": "Upang HK",
  "upang hk": "Upang HK",
  "poled": "Poled HK",
  "poled hk": "Poled HK",
};

const PLATFORM_DEFAULT_SHOPS: Record<string, string> = {
  shopline: "ReadyGo HK",
  hktvmall: "Ready Go HKTVMALL",
  shopify: "Shnuggle",
  boutir: "奧創數碼",
};

const ORDER_STATUS_ALIASES: Record<string, Order["status"] | "paid"> = {
  pending: "pending",
  new: "pending",
  open: "pending",
  confirmed: "confirmed",
  processing: "confirmed",
  delivering: "delivering",
  shipped: "delivering",
  fulfilled: "delivering",
  shipping: "delivering",
  completed: "completed",
  complete: "completed",
  done: "completed",
  paid: "paid",
};

const lineSchema = z.object({
  sku: z.string().trim().min(1).max(64).optional(),
  productId: z.number().int().positive().optional(),
  productName: z.string().trim().min(1).max(255).optional(),
  color: z.string().trim().max(100).optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  price: z.number().nonnegative().optional(),
  isGift: z.boolean().optional(),
}).refine((line) => Boolean(line.sku) || Boolean(line.productId), {
  message: "Each line needs sku or productId",
});

const importOrderSchema = z.object({
  platform: z.string().trim().min(1).max(32),
  externalOrderId: z.string().trim().min(1).max(191),
  shopName: z.string().trim().min(1).max(255).optional(),
  shopKey: z.string().trim().min(1).max(255).optional(),
  customerName: z.string().trim().min(1).max(255),
  customerPhone: z.string().trim().max(50).optional(),
  customerEmail: z.string().trim().max(320).optional(),
  deliveryAddress: z.string().trim().max(5000).optional(),
  deliveryDate: z.string().trim().min(1).optional(),
  deliveryTimeSlot: z.string().trim().max(50).optional(),
  notes: z.string().max(10000).optional(),
  packageName: z.string().trim().max(255).optional(),
  orderAmount: z.number().nonnegative().optional(),
  commission: z.number().nonnegative().optional(),
  paymentStatus: z.enum(["unpaid", "partial", "paid"]).optional(),
  paid: z.boolean().optional(),
  paidAmount: z.number().nonnegative().optional(),
  status: z.string().trim().min(1).optional(),
  items: z.array(lineSchema).min(1).max(100),
});

export type ImportOrderInput = z.infer<typeof importOrderSchema>;

export class OrderImportError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;
  orderId?: number;
  orderNumber?: string;
  platform?: string;
  externalOrderId?: string;

  constructor(code: string, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = "OrderImportError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export type ImportedOrderSummary = {
  id: number;
  orderNumber: string;
  shopName: string;
  platform: string;
  externalOrderId: string;
  status: Order["status"];
  paymentStatus: Order["paymentStatus"];
  paidAmount: string;
};

export type ImportSuccess = {
  ok: true;
  idempotent: boolean;
  code: "CREATED" | "ALREADY_IMPORTED";
  order: ImportedOrderSummary;
};

export type ImportFailure = {
  ok: false;
  code: string;
  message: string;
  platform?: string;
  externalOrderId?: string;
  orderId?: number;
  orderNumber?: string;
  details?: unknown;
};

type ParsedOrder = ImportOrderInput & {
  platform: string;
  orderStatus: Order["status"];
  paymentStatus?: Order["paymentStatus"];
  paidAmount?: number;
};

function asNumber(value: unknown): unknown {
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return value;
}

function asId(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return value;
}

function asBool(value: unknown): unknown {
  if (value === "yes" || value === "true" || value === 1) return true;
  if (value === "no" || value === "false" || value === 0) return false;
  return value;
}

function coerceOrder(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const source = raw as Record<string, unknown>;
  const itemsRaw = source.items ?? source.lineItems ?? source.lines;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((item) => {
        if (!item || typeof item !== "object") return item;
        const line = item as Record<string, unknown>;
        return {
          ...line,
          sku: line.sku ?? line.SKU,
          productId: asNumber(line.productId ?? line.product_id),
          quantity: asNumber(line.quantity ?? line.qty),
          unitPrice: asNumber(line.unitPrice ?? line.unit_price),
          price: asNumber(line.price),
          isGift: asBool(line.isGift ?? line.is_gift),
        };
      })
    : itemsRaw;

  return {
    ...source,
    platform: source.platform ?? source.externalPlatform ?? source.source,
    externalOrderId: asId(source.externalOrderId ?? source.externalId ?? source.platformOrderId),
    shopName: source.shopName ?? source.shop,
    shopKey: source.shopKey ?? source.shopHint,
    customerName: source.customerName ?? source.name,
    customerPhone: source.customerPhone ?? source.phone,
    customerEmail: source.customerEmail ?? source.email,
    deliveryAddress: source.deliveryAddress ?? source.address ?? source.shippingAddress,
    orderAmount: asNumber(source.orderAmount ?? source.total ?? source.amount),
    commission: asNumber(source.commission),
    paidAmount: asNumber(source.paidAmount),
    items,
  };
}

export function normalizePlatform(platform: string): string {
  return platform.trim().toLowerCase().replace(/\s+/g, "");
}

function parseOrder(raw: unknown): ParsedOrder {
  let value: ImportOrderInput;
  try {
    value = importOrderSchema.parse(coerceOrder(raw));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new OrderImportError(
        "VALIDATION_ERROR",
        error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
        400,
        error.issues,
      );
    }
    throw error;
  }

  const platform = normalizePlatform(value.platform);
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(platform)) {
    throw new OrderImportError(
      "VALIDATION_ERROR",
      "platform must be 1-32 characters of letters, numbers, underscore, or hyphen",
      400,
    );
  }

  const statusToken = (value.status ?? "pending").toLowerCase();
  if (statusToken === "cancelled" || statusToken === "canceled") {
    throw new OrderImportError(
      "VALIDATION_ERROR",
      "Cancelled orders are not imported. Import the order while it is open, then cancel it in the OMS.",
      400,
    );
  }

  const mapped = ORDER_STATUS_ALIASES[statusToken];
  if (!mapped) {
    throw new OrderImportError(
      "VALIDATION_ERROR",
      `Unknown status "${value.status}". Use pending, confirmed, delivering, or completed.`,
      400,
    );
  }

  let orderStatus: Order["status"] = mapped === "paid" ? "pending" : mapped;
  let paymentStatus = value.paymentStatus;
  let paidAmount = value.paidAmount;

  if (mapped === "paid" || value.paid === true) {
    paymentStatus = paymentStatus ?? "paid";
  }
  if (paymentStatus === "partial" && (paidAmount === undefined || paidAmount <= 0)) {
    throw new OrderImportError("VALIDATION_ERROR", "paymentStatus partial requires paidAmount greater than 0", 400);
  }

  return {
    ...value,
    platform,
    orderStatus,
    paymentStatus,
    paidAmount,
  };
}

export function canonicalShopAlias(name: string): string | undefined {
  return SHOP_ALIASES[name.trim().toLowerCase()];
}

async function findShopLoose(name: string): Promise<Shop | undefined> {
  const exact = await getShopByName(name);
  if (exact) return exact;
  const shops = await getAllShops(true);
  const needle = name.trim().toLowerCase();
  return shops.find((shop) => shop.name.trim().toLowerCase() === needle);
}

/**
 * Pick the OMS shop name for a platform order.
 * An existing shop with the same name wins. Known aliases map onto the
 * canonical shop (ReadyGo HK, Ready Go HKTVMALL, Upang HK, Poled HK, Shnuggle, 奧創數碼).
 */
export async function resolveImportShopName(input: {
  platform: string;
  shopName?: string;
  shopKey?: string;
}): Promise<string> {
  const platform = normalizePlatform(input.platform);
  const explicit = input.shopName?.trim();
  const key = input.shopKey?.trim();

  const pick = async (candidate: string, allowAlias: boolean): Promise<string> => {
    const existing = await findShopLoose(candidate);
    if (existing) return existing.name;
    if (allowAlias) {
      const alias = canonicalShopAlias(candidate);
      if (alias) {
        const aliased = await findShopLoose(alias);
        return aliased?.name ?? alias;
      }
    }
    return candidate;
  };

  let resolved: string;
  if (explicit) {
    resolved = await pick(explicit, true);
  } else if (key) {
    const alias = canonicalShopAlias(key);
    if (!alias) {
      throw new OrderImportError(
        "SHOP_REQUIRED",
        `Unknown shop key "${key}". Use shopName, or shopKey: upang, poled, shnuggle, hktvmall, readygo.`,
        400,
      );
    }
    const existing = await findShopLoose(alias);
    resolved = existing?.name ?? alias;
  } else {
    const fallback = PLATFORM_DEFAULT_SHOPS[platform];
    if (!fallback) {
      throw new OrderImportError(
        "SHOP_REQUIRED",
        platform === "wix"
          ? 'Wix orders need shopKey "upang" or "poled", or an explicit shopName. UPANG and Poled are separate shops.'
          : `Platform "${platform}" has no default shop. Pass shopName.`,
        400,
      );
    }
    const existing = await findShopLoose(fallback);
    resolved = existing?.name ?? fallback;
  }

  if (resolved.trim() === ULTRON_SHOP_NAME) {
    throw new OrderImportError(
      "SHOP_CONFLICT",
      `Shop "${ULTRON_SHOP_NAME}" is the warehouse deducted when an order moves to delivering. ` +
        'Use retail shop "奧創數碼" for Boutir so the sale and the warehouse stay separate.',
      400,
    );
  }

  return resolved;
}

async function ensureShop(name: string): Promise<Shop> {
  const existing = await findShopLoose(name);
  if (existing) return existing;

  try {
    const id = await createShop({ name, sortOrder: 0, isActive: "yes" });
    const created = await getShopById(id);
    if (created) return created;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  const again = await findShopLoose(name);
  if (again) return again;
  throw new OrderImportError("IMPORT_FAILED", `Could not create shop "${name}"`, 500);
}

type ResolvedLine = {
  sku: string;
  productName: string;
  color: string | null;
  quantity: number;
  unitPrice: number;
  isGift: boolean;
};

async function resolveLines(items: ImportOrderInput["items"]): Promise<ResolvedLine[]> {
  const lines: ResolvedLine[] = [];
  for (const item of items) {
    const product = item.productId
      ? await getProductById(item.productId)
      : await getProductBySku(item.sku!.trim());

    if (!product || product.isActive === "no") {
      const label = item.productId ? `id ${item.productId}` : `SKU ${item.sku}`;
      throw new OrderImportError(
        "PRODUCT_NOT_FOUND",
        `No active OMS product for ${label}. Platform SKUs must match products.sku (or pass productId).`,
        422,
        { sku: item.sku, productId: item.productId },
      );
    }

    if (item.sku && item.sku.trim().toLowerCase() !== product.sku.trim().toLowerCase()) {
      throw new OrderImportError(
        "PRODUCT_NOT_FOUND",
        `SKU ${item.sku} does not match OMS product ${product.id} (${product.sku}).`,
        422,
        { sku: item.sku, productId: product.id, omsSku: product.sku },
      );
    }

    const unitPrice = item.unitPrice ?? item.price ?? Number(product.price ?? 0);
    lines.push({
      sku: product.sku,
      productName: item.productName?.trim() || product.name,
      color: item.color ?? product.color ?? null,
      quantity: item.quantity,
      unitPrice,
      isGift: item.isGift === true,
    });
  }
  return lines;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function summarize(order: Order, platform: string, externalOrderId: string, idempotent: boolean): ImportSuccess {
  return {
    ok: true,
    idempotent,
    code: idempotent ? "ALREADY_IMPORTED" : "CREATED",
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      shopName: order.shopName,
      platform,
      externalOrderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paidAmount: String(order.paidAmount ?? "0"),
    },
  };
}

async function loadCompletedImport(platform: string, externalOrderId: string, orderId: number | null): Promise<ImportSuccess> {
  if (!orderId) {
    throw new OrderImportError(
      "IMPORTED_ORDER_MISSING",
      `External order ${platform}:${externalOrderId} is marked imported but has no OMS order id.`,
      409,
    );
  }
  const order = await getOrderById(orderId);
  if (!order) {
    throw new OrderImportError(
      "IMPORTED_ORDER_MISSING",
      `External order ${platform}:${externalOrderId} points at missing OMS order ${orderId}.`,
      409,
    );
  }
  return summarize(order, platform, externalOrderId, true);
}

function freshProcessing(updatedAt: Date | null | undefined): boolean {
  if (!updatedAt) return true;
  return Date.now() - new Date(updatedAt).getTime() < 2 * 60 * 1000;
}

/**
 * Import one external order through the normal create path (shop + Hong Kong stock).
 * A second call with the same platform and externalOrderId returns the original order
 * and does not deduct stock again. Status delivering also runs the Ultron warehouse
 * deduction and rejects when that warehouse is short.
 */
export async function importExternalOrder(raw: unknown): Promise<ImportSuccess> {
  const input = parseOrder(raw);
  const { platform, externalOrderId } = input;

  const prior = await getExternalOrderImport(platform, externalOrderId);
  if (prior?.status === "completed") {
    return loadCompletedImport(platform, externalOrderId, prior.orderId);
  }
  if (prior?.status === "processing" && freshProcessing(prior.updatedAt)) {
    throw new OrderImportError(
      "IMPORT_IN_PROGRESS",
      `Import of ${platform}:${externalOrderId} is already in progress. Retry shortly.`,
      409,
    );
  }

  const shopName = await resolveImportShopName({
    platform,
    shopName: input.shopName,
    shopKey: input.shopKey,
  });
  const shop = await ensureShop(shopName);
  const lines = await resolveLines(input.items);

  if (input.orderStatus === "delivering") {
    const { shortages } = await findUltronDeliveryShortages(lines.map((line) => ({
      sku: line.sku,
      productName: line.productName,
      quantity: line.quantity,
      isGift: line.isGift,
    })));
    if (shortages.length > 0) {
      throw new OrderImportError(
        "INSUFFICIENT_STOCK",
        `Ultron warehouse (${ULTRON_SHOP_NAME}) does not have enough stock to mark this order delivering.`,
        409,
        { shortages },
      );
    }
  }

  const claim = await claimExternalOrderImport({
    platform,
    externalOrderId,
    shopName: shop.name,
  });
  if (claim.outcome === "completed") {
    return loadCompletedImport(platform, externalOrderId, claim.row.orderId);
  }
  if (claim.outcome === "in_progress") {
    throw new OrderImportError(
      "IMPORT_IN_PROGRESS",
      `Import of ${platform}:${externalOrderId} is already in progress. Retry shortly.`,
      409,
    );
  }

  const products = lines.filter((line) => !line.isGift);
  const gifts = lines.filter((line) => line.isGift);
  const orderAmount = roundMoney(
    input.orderAmount ?? lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  );
  const note = [
    input.notes?.trim(),
    `外部訂單 ${platform}:${externalOrderId}`,
  ].filter(Boolean).join("\n");

  let created: { id: number; orderNumber: string } | null = null;
  try {
    created = await createOrderWithStockDeduction({
      customerName: input.customerName,
      customerPhone: input.customerPhone?.trim() || MISSING_CONTACT,
      customerEmail: input.customerEmail?.trim() || null,
      packageName: input.packageName?.trim() || "其他｜單件產品購買",
      shopName: shop.name,
      orderAmount,
      commission: input.commission ?? 0,
      deliveryAddress: input.deliveryAddress?.trim() || MISSING_CONTACT,
      deliveryDate: input.deliveryDate,
      deliveryTimeSlot: input.deliveryTimeSlot,
      notes: note,
      products,
      gifts,
      notify: false,
    });

    if (input.paymentStatus) {
      const paidAmount = input.paymentStatus === "paid"
        ? (input.paidAmount ?? orderAmount)
        : (input.paidAmount ?? 0);
      await updateOrder(created.id, {
        paymentStatus: input.paymentStatus,
        paidAmount: roundMoney(paidAmount).toFixed(2),
      });
    }

    if (input.orderStatus !== "pending") {
      try {
        await applyOrderStatusTransition({
          id: created.id,
          status: input.orderStatus,
          notify: false,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Status update failed";
        const wrapped = new OrderImportError(
          message.includes("庫存不足") ? "INSUFFICIENT_STOCK" : "IMPORT_FAILED",
          message,
          message.includes("庫存不足") ? 409 : 500,
        );
        wrapped.orderId = created.id;
        wrapped.orderNumber = created.orderNumber;
        throw wrapped;
      }
    }

    await completeExternalOrderImport(claim.id, created.id);
    const order = await getOrderById(created.id);
    if (!order) {
      throw new OrderImportError("IMPORT_FAILED", "Order was created but could not be reloaded", 500);
    }
    return summarize(order, platform, externalOrderId, false);
  } catch (error) {
    if (created) {
      await completeExternalOrderImport(claim.id, created.id);
    } else {
      await releaseExternalOrderImport(claim.id);
    }
    if (error instanceof OrderImportError) {
      error.platform = platform;
      error.externalOrderId = externalOrderId;
      if (created) {
        error.orderId = error.orderId ?? created.id;
        error.orderNumber = error.orderNumber ?? created.orderNumber;
      }
    }
    throw error;
  }
}

export async function importExternalOrderSafe(raw: unknown): Promise<ImportSuccess | ImportFailure> {
  try {
    return await importExternalOrder(raw);
  } catch (error) {
    if (error instanceof OrderImportError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        platform: error.platform,
        externalOrderId: error.externalOrderId,
        orderId: error.orderId,
        orderNumber: error.orderNumber,
        details: error.details,
      };
    }
    console.error("[order-import] unexpected failure", error);
    return {
      ok: false,
      code: "IMPORT_FAILED",
      message: error instanceof Error ? error.message : "Import failed",
    };
  }
}

export function presentedImportKey(headers: Request["headers"]): string {
  const authorization = headers.authorization;
  if (typeof authorization === "string") {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization.trim());
    if (match) return match[1];
  }
  const header = headers["x-api-key"];
  if (typeof header === "string") return header.trim();
  if (Array.isArray(header) && header[0]) return header[0].trim();
  return "";
}

export function importKeysMatch(presented: string, expected: string): boolean {
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function authorizeImport(headers: Request["headers"]): ImportFailure | null {
  const expected = process.env.OMS_IMPORT_API_KEY?.trim() ?? "";
  if (!expected) {
    return {
      ok: false,
      code: "API_KEY_NOT_CONFIGURED",
      message: "OMS_IMPORT_API_KEY is not set on the server.",
    };
  }
  const presented = presentedImportKey(headers);
  if (!presented || !importKeysMatch(presented, expected)) {
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid import API key. Send Authorization: Bearer <OMS_IMPORT_API_KEY> or X-API-Key.",
    };
  }
  return null;
}

function httpStatusFor(result: ImportSuccess | ImportFailure): number {
  if (result.ok) return result.code === "CREATED" ? 201 : 200;
  switch (result.code) {
    case "UNAUTHORIZED":
      return 401;
    case "API_KEY_NOT_CONFIGURED":
      return 503;
    case "VALIDATION_ERROR":
    case "SHOP_REQUIRED":
    case "SHOP_CONFLICT":
    case "BATCH_TOO_LARGE":
      return 400;
    case "PRODUCT_NOT_FOUND":
      return 422;
    case "INSUFFICIENT_STOCK":
    case "IMPORT_IN_PROGRESS":
    case "IMPORTED_ORDER_MISSING":
      return 409;
    default:
      return 500;
  }
}

export async function handleOrderImport(req: Request, res: Response): Promise<void> {
  const denied = authorizeImport(req.headers);
  if (denied) {
    res.status(httpStatusFor(denied)).json(denied);
    return;
  }

  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "JSON object body is required.",
    });
    return;
  }

  if (Array.isArray((body as { orders?: unknown }).orders)) {
    const orders = (body as { orders: unknown[] }).orders;
    if (orders.length === 0) {
      res.status(400).json({
        ok: false,
        code: "VALIDATION_ERROR",
        message: "orders must contain at least one order.",
      });
      return;
    }
    if (orders.length > MAX_IMPORT_BATCH) {
      res.status(400).json({
        ok: false,
        code: "BATCH_TOO_LARGE",
        message: `At most ${MAX_IMPORT_BATCH} orders per request.`,
      });
      return;
    }
    const results = [];
    for (const order of orders) {
      results.push(await importExternalOrderSafe(order));
    }
    const ok = results.every((result) => result.ok);
    res.status(ok ? 200 : 207).json({ ok, results });
    return;
  }

  const result = await importExternalOrderSafe(body);
  res.status(httpStatusFor(result)).json(result);
}

export function registerOrderImportRoutes(app: Express): void {
  app.post("/api/import/orders", (req, res) => {
    void handleOrderImport(req, res).catch((error) => {
      console.error("[order-import] handler failure", error);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, code: "IMPORT_FAILED", message: "Import failed" });
      }
    });
  });
}
