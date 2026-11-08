const express = require("express");
const { EDPayClient } = require("./edpay-client");

const app = express();
const port = process.env.PORT || 3000;

const client = new EDPayClient({
  publicKey: process.env.EDPAY_PUBLIC_KEY,
  privateKey: process.env.EDPAY_PRIVATE_KEY,
  webhookSecret: process.env.EDPAY_WEBHOOK_SECRET,
  baseUrl: process.env.EDPAY_API_URL || "https://api-pay.edutecka.com",
});

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Healthcheck
app.get("/health", (_req, res) => res.json({ status: "healthy", service: "edpay-shopify-app" }));

/**
 * Shopify Payments App Session Initiation
 * POST /payment-session
 */
app.post("/payment-session", async (req, res) => {
  try {
    const { id, amount, currency, customer, payment_method } = req.body;
    const checkoutUrl = await client.createPaymentLink({
      id,
      amount: parseFloat(amount),
      currency,
      title: `Shopify Checkout (${id})`,
      customerEmail: customer?.email,
      returnUrl: `${process.env.APP_URL}/shopify/return?id=${id}`,
      cancelUrl: `${process.env.APP_URL}/shopify/cancel?id=${id}`,
    });

    res.json({
      redirect_url: checkoutUrl,
    });
  } catch (error) {
    console.error("Payment session error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * EDPay Webhook Listener
 * POST /webhook/edpay
 */
app.post("/webhook/edpay", async (req, res) => {
  const signature = req.headers["x-edpay-signature"];
  const isValid = client.verifyWebhookSignature(req.rawBody, signature);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid HMAC signature" });
  }

  const event = req.body;
  if (event.type === "payment.succeeded") {
    const payment = event.data;
    const shopifySessionId = payment.metadata?.shopify_payment_session_id;

    if (shopifySessionId) {
      // Notify Shopify GraphQL Payments API: paymentSessionResolve
      console.log(`Resolving Shopify session ${shopifySessionId} with EDPay payment ${payment.id}`);
    }
  }

  res.json({ status: "acknowledged" });
});

app.listen(port, () => {
  console.log(`EDPay Shopify Payments App listening on port ${port}`);
});
