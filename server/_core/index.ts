import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStripeWebhook } from "../stripeWebhook";
import { appRouter } from "../routers";
import { generateQuotationPdf, generateInvoicePdf, generateReceiptPdf, OrderForPdf } from "../pdfService";
import { getOrderById, getOrderProducts, getProductById } from "../db";
import { storagePut } from "../storage";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Stripe Webhook 需要在 express.json() 之前註冊（使用 raw body）
  registerStripeWebhook(app);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // PDF generation endpoint - generates PDF, uploads to S3, returns URL
  app.get("/api/pdf/:orderId/:type", async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const type = req.params.type as "quotation" | "invoice" | "receipt";
      
      if (!orderId || !["quotation", "invoice", "receipt"].includes(type)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }
      
      const order = await getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const orderProductsList = await getOrderProducts(orderId);
      const productsWithDetails = await Promise.all(
        orderProductsList.map(async (op: any) => {
          const product = op.productId ? await getProductById(op.productId) : null;
          return {
            sku: op.sku || product?.sku || "",
            name: op.productName || product?.name || "",
            color: op.color || product?.color || "",
            quantity: op.quantity,
            isGift: op.isGift === "yes",
          };
        })
      );
      
      const products = productsWithDetails.filter((p: any) => !p.isGift);
      const gifts = productsWithDetails.filter((p: any) => p.isGift);
      
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
      const typeNames: Record<string, string> = { quotation: "報價單", invoice: "發票", receipt: "收據" };
      
      switch (type) {
        case "quotation":
          pdfBuffer = await generateQuotationPdf(orderForPdf);
          break;
        case "invoice":
          pdfBuffer = await generateInvoicePdf(orderForPdf);
          break;
        case "receipt":
          pdfBuffer = await generateReceiptPdf(orderForPdf);
          break;
        default:
          return res.status(400).json({ error: "Invalid type" });
      }
      
      const filename = `${typeNames[type]}_${order.orderNumber}.pdf`;
      
      // Upload PDF to S3 and return the URL
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const fileKey = `pdfs/${order.orderNumber}/${type}-${randomSuffix}.pdf`;
      const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");
      
      // Return JSON with download URL
      res.json({ url: pdfUrl, filename });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: error.message || "PDF generation failed" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
