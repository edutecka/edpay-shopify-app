const crypto = require("crypto");

class EDPayClient {
  constructor({ publicKey, privateKey, webhookSecret, baseUrl = "https://api-pay.edutecka.com" }) {
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.webhookSecret = webhookSecret;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async createPaymentLink({ id, amount, currency, title, customerEmail, returnUrl, cancelUrl }) {
    const response = await fetch(`${this.baseUrl}/v1/core/payment-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EDPay-Public-Key": this.publicKey,
        "X-EDPay-Private-Key": this.privateKey,
        "Idempotency-Key": `shopify-${id}-${Date.now()}`,
      },
      body: JSON.stringify({
        title: title || `Shopify Order #${id}`,
        amount: Math.round(amount * 100), // in centavos
        currency: currency || "MZN",
        metadata: {
          shopify_payment_session_id: id,
          customer_email: customerEmail,
        },
        success_url: returnUrl,
        cancel_url: cancelUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`EDPay API error (HTTP ${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.data?.hosted_url || data.data?.checkout_url;
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!this.webhookSecret) return true;
    const hmac = crypto.createHmac("sha256", this.webhookSecret);
    const expected = hmac.update(rawBody).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
  }
}

module.exports = { EDPayClient };
