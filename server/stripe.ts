import Stripe from "stripe";
import { ENV } from "./_core/env";

const STRIPE_API_VERSION = "2025-12-15.clover" as const;

let stripeClient: Stripe | null = null;

/** Built on first use so the process can boot without STRIPE_SECRET_KEY. */
export function getStripe(): Stripe {
  const key = ENV.stripeSecretKey.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  }
  return stripeClient;
}

// 建立付款連結
export async function createPaymentLink(params: {
  orderId: number;
  orderNumber: string;
  amount: number; // 以港幣計算
  customerName: string;
  customerEmail?: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "hkd",
          product_data: {
            name: `訂單 ${params.orderNumber}`,
            description: params.description || `訂單金額`,
          },
          unit_amount: Math.round(params.amount * 100), // Stripe 使用最小貨幣單位（分）
        },
        quantity: 1,
      },
    ],
    customer_email: params.customerEmail || undefined,
    client_reference_id: params.orderId.toString(),
    metadata: {
      order_id: params.orderId.toString(),
      order_number: params.orderNumber,
      customer_name: params.customerName,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
  });

  return {
    url: session.url!,
    sessionId: session.id,
  };
}

// 驗證 Webhook 簽名
export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    payload,
    signature,
    ENV.stripeWebhookSecret || ""
  );
}

// 獲取付款意圖詳情
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.retrieve(paymentIntentId);
}

// 獲取 Checkout Session 詳情
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId);
}
