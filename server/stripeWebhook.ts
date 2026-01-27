import { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { createPayment, updateOrderPaymentStatus, getOrderById, updateCustomerStats } from "./db";

// 初始化 Stripe
const stripe = new Stripe(ENV.stripeSecretKey || "", {
  apiVersion: "2025-12-15.clover",
});

export function registerStripeWebhook(app: Express) {
  // Stripe Webhook 需要使用 raw body
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const signature = req.headers["stripe-signature"] as string;

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          ENV.stripeWebhookSecret || ""
        );
      } catch (err: any) {
        console.error(`[Stripe Webhook] Signature verification failed:`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // 處理測試事件
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            
            // 從 metadata 獲取訂單資訊
            const orderId = parseInt(session.metadata?.order_id || session.client_reference_id || "0");
            
            if (orderId > 0) {
              // 建立付款記錄
              await createPayment({
                orderId,
                paymentMethod: "stripe",
                amount: ((session.amount_total || 0) / 100).toString(), // 轉換回港幣
                stripePaymentIntentId: session.payment_intent as string,
                status: "completed",
                paidAt: new Date(),
                notes: `Stripe Checkout Session: ${session.id}`,
              });

              // 更新訂單付款狀態
              await updateOrderPaymentStatus(orderId);

              // 如果訂單有關聯顧客，更新顧客統計
              const order = await getOrderById(orderId);
              if (order?.customerId) {
                await updateCustomerStats(order.customerId);
              }

              console.log(`[Stripe Webhook] Payment completed for order ${orderId}`);
            }
            break;
          }

          case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log(`[Stripe Webhook] PaymentIntent succeeded: ${paymentIntent.id}`);
            break;
          }

          case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            console.log(`[Stripe Webhook] PaymentIntent failed: ${paymentIntent.id}`);
            break;
          }

          default:
            console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (err: any) {
        console.error(`[Stripe Webhook] Error processing event:`, err);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    }
  );
}
