const crypto = require("crypto");
const sessionStore = require("./session-store");

class EDPayClient {
  constructor({ publicKey, privateKey, webhookSecret, webhookToleranceSeconds = 300, baseUrl = "https://api-pay.edutecka.com" }) {
    const normalizedPublicKey = typeof publicKey === "string" ? publicKey.trim() : "";
    const normalizedPrivateKey = typeof privateKey === "string" ? privateKey.trim() : "";
    const publicMode = normalizedPublicKey.match(/^pk_(test|live)_[a-fA-F0-9]{24}$/)?.[1] ?? null;
    const privateMode = normalizedPrivateKey.match(/^sk_(test|live)_[a-fA-F0-9]{64}$/)?.[1] ?? null;
    if (!publicMode || !privateMode || publicMode !== privateMode) {
      throw new Error("EDPay requires a valid public and private API key pair from the same environment.");
    }
    this.publicKey = normalizedPublicKey;
    this.privateKey = normalizedPrivateKey;
    this.webhookSecret = webhookSecret;
    this.webhookToleranceSeconds = Number.isInteger(webhookToleranceSeconds) && webhookToleranceSeconds >= 0
      ? webhookToleranceSeconds
      : 300;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async createPayment({ id, sessionGid, amountMinor, currency }) {
    const orderKey = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
    const headers = {
      "Content-Type": "application/json",
      "X-EDPay-Public-Key": this.publicKey,
      "X-EDPay-Private-Key": this.privateKey,
    };
    const paymentResponse = await fetch(`${this.baseUrl}/v1/payments`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": `shopify-${orderKey}-payment-create` },
      body: JSON.stringify({ amount_minor: amountMinor, currency, reference: String(id), description: `Shopify payment ${id}` }),
    });
    if (!paymentResponse.ok) throw new Error(`EDPay payment API error (HTTP ${paymentResponse.status})`);
    const paymentResult = await paymentResponse.json();
    const paymentId = paymentResult.data?.id;
    if (typeof paymentId !== "string" || !paymentId) throw new Error("EDPay did not return a payment ID");
    const sessionResponse = await fetch(`${this.baseUrl}/v1/payments/${encodeURIComponent(paymentId)}/public-checkout`, {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": `shopify-${orderKey}-public-checkout` },
      body: JSON.stringify({}),
    });
    if (!sessionResponse.ok) throw new Error(`EDPay public-checkout API error (HTTP ${sessionResponse.status})`);
    const session = await sessionResponse.json();
    const token = session.data?.token ?? session.token;
    if (typeof token !== "string" || !token) throw new Error("EDPay did not return a checkout token");
    const hostedUrl = new URL("https://pay.edutecka.com/pay");
    hostedUrl.searchParams.set("token", token);
    hostedUrl.searchParams.set("pk", this.publicKey);
    await sessionStore.save(String(id), String(sessionGid), amountMinor, currency);
    return { url: hostedUrl.toString(), paymentId, reference: String(id), amountMinor, currency };
  }

  async shopifyMutation(query, variables) {
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ACCESS_TOKEN;
    const version = process.env.SHOPIFY_PAYMENTS_API_VERSION || "2026-01";
    if (!shop || !token || !/^\d{4}-\d{2}$/.test(version)) {
      throw new Error("Shopify Payments API credentials are not configured");
    }
    const response = await fetch(`https://${shop}/payments_apps/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });
    const result = await response.json();
    if (!response.ok || result.errors?.length) throw new Error("Shopify Payments API request failed");
    return result.data;
  }

  async finalizeShopifySession(sessionId, succeeded, eventType = "payment.failed") {
    const mutation = succeeded
      ? `mutation Resolve($id: ID!) { paymentSessionResolve(id: $id) { paymentSession { id } userErrors { message } } }`
      : `mutation Reject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) { paymentSessionReject(id: $id, reason: $reason) { paymentSession { id } userErrors { message } } }`;
    const variables = succeeded
      ? { id: sessionId }
      : { id: sessionId, reason: {
        code: eventType === "payment.cancelled" ? "CANCELLED_PAYMENT" : "PROCESSING_ERROR",
        source: "NETWORK",
        merchantMessage: eventType === "payment.cancelled" ? "Payment was cancelled." : "Payment was not completed.",
      } };
    const data = await this.shopifyMutation(mutation, variables);
    const result = succeeded ? data.paymentSessionResolve : data.paymentSessionReject;
    if (!result?.paymentSession || result.userErrors?.length) throw new Error("Shopify could not finalize the payment session");
    return true;
  }

  verifyWebhookSignature(rawBody, signatureHeader, now = Math.floor(Date.now() / 1000)) {
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || !this.webhookSecret || !signatureHeader) return false;

    const fields = {};
    for (const field of signatureHeader.split(",")) {
      const separator = field.indexOf("=");
      if (separator < 0) continue;
      const key = field.slice(0, separator).trim();
      const value = field.slice(separator + 1).trim();
      if (key === "t" || key === "v1") {
        if (Object.prototype.hasOwnProperty.call(fields, key)) return false;
        fields[key] = value;
      }
    }

    if (!/^\d+$/.test(fields.t || "") || !/^[a-f\d]{64}$/i.test(fields.v1 || "") || !Number.isSafeInteger(now)) {
      return false;
    }
    const signedAt = Number(fields.t);
    if (!Number.isSafeInteger(signedAt) || Math.abs(now - signedAt) > this.webhookToleranceSeconds) return false;

    const expected = crypto.createHmac("sha256", this.webhookSecret)
      .update(fields.t, "ascii")
      .update(".", "ascii")
      .update(rawBody)
      .digest();
    const received = Buffer.from(fields.v1, "hex");
    return received.length === expected.length && crypto.timingSafeEqual(expected, received);
  }
}

module.exports = { EDPayClient };
