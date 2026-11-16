const express = require("express");
const https = require("https");
const fs = require("fs");
const { EDPayClient } = require("./edpay-client");
const sessionStore = require("./session-store");

const app = express();
const port = process.env.PORT || 3000;
const configuredWebhookTolerance = Number(process.env.EDPAY_WEBHOOK_TOLERANCE_SECONDS ?? 300);

const client = new EDPayClient({
  publicKey: process.env.EDPAY_PUBLIC_KEY,
  privateKey: process.env.EDPAY_PRIVATE_KEY,
  webhookSecret: process.env.EDPAY_WEBHOOK_SECRET,
  webhookToleranceSeconds: Number.isInteger(configuredWebhookTolerance) && configuredWebhookTolerance >= 0
    ? configuredWebhookTolerance
    : 300,
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
    const { id, gid, group, amount, currency, test, merchant_locale, payment_method, proposed_at, kind } = req.body;
    const shopHeader = req.get("Shopify-Shop-Domain");
    const cancelUrl = payment_method?.data?.cancel_url;
    let validCancelUrl = false;
    try {
      const parsedCancelUrl = new URL(cancelUrl);
      validCancelUrl = parsedCancelUrl.protocol === "https:";
    } catch (_) {}
    const amountParts = typeof amount === "string" ? amount.match(/^(\d+)(?:\.(\d{1,2}))?$/) : null;
    const amountMinor = amountParts ? Number(amountParts[1]) * 100 + Number((amountParts[2] || "").padEnd(2, "0") || 0) : NaN;
    const expectedPrefix = test === true ? "pk_test_" : "pk_live_";
    if (!req.socket.authorized || !shopHeader || shopHeader !== process.env.SHOPIFY_SHOP_DOMAIN
      || typeof id !== "string" || !id || typeof gid !== "string" || !gid
      || typeof group !== "string" || !group
      || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !/^[A-Z]{3}$/.test(currency || "")
      || typeof test !== "boolean" || typeof merchant_locale !== "string" || !merchant_locale
      || !payment_method || payment_method.type !== "offsite"
      || !validCancelUrl
      || typeof proposed_at !== "string" || !Number.isFinite(Date.parse(proposed_at)) || kind !== "sale"
      || !String(process.env.EDPAY_PUBLIC_KEY || "").startsWith(expectedPrefix)
      || !String(process.env.EDPAY_PRIVATE_KEY || "").startsWith(test ? "sk_test_" : "sk_live_")) {
      return res.status(400).json({ error: "Invalid Shopify payment session" });
    }
    const checkout = await client.createPaymentLink({
      id,
      sessionGid: gid,
      amountMinor,
      currency,
    });

    return res.status(200).json({ redirect_url: checkout.url });
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
  const signature = req.headers["payment-signature"];
  const isValid = client.verifyWebhookSignature(req.rawBody, signature);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  const event = req.body;
  if (event.type === "payment.succeeded") {
    const payment = event.data;
    const linkId = payment.payment_link_id;
    const mapping = typeof linkId === "string" ? await sessionStore.get(linkId) : null;
    if (!mapping || payment.status !== "succeeded" || !payment.id
      || Number(payment.amount_minor) !== mapping.amountMinor
      || String(payment.currency).toUpperCase() !== String(mapping.currency).toUpperCase()) {
      return res.status(409).json({ error: "Payment link, status, amount, or currency mismatch" });
    }
    if (!await sessionStore.claim(linkId, payment.id)) {
      return res.status(409).json({ error: "Payment link already processed" });
    }
    try {
      await client.finalizeShopifySession(mapping.sessionId, true, event.type);
      await sessionStore.markResolved(linkId, payment.id);
    } catch (error) {
      await sessionStore.release(linkId, payment.id);
      console.error("Shopify payment finalization failed:", error.message);
      return res.status(502).json({ error: "Unable to finalize Shopify payment session" });
    }
  } else if (event.type === "payment.failed" || event.type === "payment.cancelled") {
    const payment = event.data || {};
    const linkId = payment.payment_link_id;
    const mapping = typeof linkId === "string" ? await sessionStore.get(linkId) : null;
    if (!mapping || payment.status !== "failed" && payment.status !== "cancelled" || !payment.id
      || Number(payment.amount_minor) !== mapping.amountMinor
      || String(payment.currency).toUpperCase() !== String(mapping.currency).toUpperCase()) {
      return res.status(409).json({ error: "Payment link or status mismatch" });
    }
    if (!await sessionStore.claim(linkId, payment.id)) return res.status(409).json({ error: "Payment link already processed" });
    try {
      await client.finalizeShopifySession(mapping.sessionId, false, event.type);
      await sessionStore.markResolved(linkId, payment.id);
    } catch (error) {
      await sessionStore.release(linkId, payment.id);
      console.error("Shopify payment rejection failed:", error.message);
      return res.status(502).json({ error: "Unable to finalize Shopify payment session" });
    }
  }

  res.json({ status: "acknowledged" });
});

const requiredTlsFiles = [process.env.TLS_KEY_PATH, process.env.TLS_CERT_PATH, process.env.SHOPIFY_MTLS_CA_PATH];
if (requiredTlsFiles.some((file) => !file)) {
  throw new Error("TLS_KEY_PATH, TLS_CERT_PATH, and SHOPIFY_MTLS_CA_PATH are required for Shopify payment requests");
}
https.createServer({
  key: fs.readFileSync(process.env.TLS_KEY_PATH),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  ca: fs.readFileSync(process.env.SHOPIFY_MTLS_CA_PATH),
  requestCert: true,
  rejectUnauthorized: false,
}, app).listen(port, () => {
  console.log(`EDPay Shopify Payments App listening with mutual TLS on port ${port}`);
});
