# EDPay Shopify payments integration preview

This repository contains an integration preview (beta), not a production-ready or Shopify-certified payments app. The Node.js service creates an EDPay link and checkout session, returns the hosted URL to Shopify's offsite payment-session request, and resolves/rejects the Shopify payment session from a verified EDPay webhook.

> **Important limitation:** Shopify's required mTLS and access-token configuration must be provisioned correctly. The local JSON mapping store supports a single Node process only. EDPay's hosted checkout contract does not document a merchant return URL, so this preview cannot guarantee the buyer is redirected back to Shopify after checkout. Do not treat browser redirects or webhook acknowledgements as a substitute for confirmed Shopify state.

## What the current service does

- `GET /health` returns a service health response.
- `POST /payment-session` accepts Shopify's `id`, `gid`, `amount`, and `currency` fields over mTLS. It creates the EDPay hosted checkout session, persists payment-link-to-Shopify-session correlation, and returns `{ "redirect_url": "..." }`.
- `POST /webhook/edpay` verifies EDPay's signature, checks payment-link ID, confirmed status, amount, and currency against the stored mapping, then calls Shopify's Payments Apps GraphQL API to resolve or reject the matching session. Replays and mismatches are rejected.

The offsite flow delegates payment-method choice to hosted EDPay checkout. A merchant cancel URL from Shopify is not sent into the EDPay API because its checkout-session schema has no return/cancel fields.

## Requirements

- Node.js 18 or later (the service uses the built-in `fetch` API)
- npm
- EDPay partner API keys and an EDPay webhook signing secret
- A public HTTPS development URL/tunnel if sending callbacks to a local service

## Install and run locally

```bash
git clone https://github.com/edutecka/edpay-shopify-app.git
cd edpay-shopify-app
npm install
```

Create a local `.env` file and do not commit it:

```dotenv
PORT=3000
EDPAY_API_URL=https://api-pay.edutecka.com
EDPAY_PUBLIC_KEY=pk_test_...
EDPAY_PRIVATE_KEY=sk_test_...
EDPAY_WEBHOOK_SECRET=your_webhook_secret
EDPAY_WEBHOOK_TOLERANCE_SECONDS=300
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=...
SHOPIFY_PAYMENTS_API_VERSION=2026-01
TLS_KEY_PATH=/secure/path/server.key
TLS_CERT_PATH=/secure/path/server.crt
SHOPIFY_MTLS_CA_PATH=/secure/path/shopify-client-ca.pem
EDPAY_SESSION_STORE=/secure/writable/path/payment-sessions.json
```

Partner API requests require both `EDPAY_PUBLIC_KEY` and `EDPAY_PRIVATE_KEY`, sent as `X-EDPay-Public-Key` and `X-EDPay-Private-Key`. Pair `pk_test_...` with `sk_test_...` or `pk_live_...` with `sk_live_...`; startup rejects missing, malformed, or cross-environment pairs. The implementation defaults `EDPAY_API_URL` to `https://api-pay.edutecka.com`; set it explicitly if your authorized environment uses another EDPay API URL. `EDPAY_WEBHOOK_SECRET` is required for webhook verification. The service reads `Payment-Signature: t=<unix-seconds>,v1=<hex>` and verifies HMAC-SHA256 over `timestamp + "." + raw request body`, rejecting timestamps older/newer than the default 300-second window. Set `EDPAY_WEBHOOK_TOLERANCE_SECONDS` to a different non-negative integer to change the window. Comparison is constant-time, and verification occurs before JSON processing.

The server does not load `.env` automatically. In a POSIX shell, export those values before starting it. The HTTPS listener requires TLS files and asks for a client certificate; payment-session requests without a trusted Shopify client certificate are rejected. Keep the mapping store on persistent, access-restricted storage and run a single app process.

```bash
set -a
. ./.env
set +a
npm run dev
```

The development script runs `node --watch server/index.js`. For a non-watch start, use `npm start` in the same environment.

## Example payment-session request

The offsite payment-session request uses Shopify's fields `id`, `gid`, `amount`, and `currency`. Do not emulate it over plain HTTP; the listener enforces mTLS.

```bash
curl --cert /secure/path/shopify-client.crt --key /secure/path/shopify-client.key \
  -X POST "https://localhost:3000/payment-session" \
  -H "Shopify-Shop-Domain: your-shop.myshopify.com" \
  -H "Content-Type: application/json" \
  -d '{"id":"attempt-10492","gid":"gid://shopify/PaymentSession/example","group":"opaque-group","session_id":"opaque-session","amount":"500.00","currency":"MZN","test":true,"merchant_locale":"en","payment_method":{"type":"offsite","data":{"cancel_url":"https://shop.example/checkouts/complete"}},"proposed_at":"2026-11-16T10:00:00Z","kind":"sale"}'
```

The service creates a link with `POST /v1/payment-links`, then a session with `POST /v1/checkout/sessions`, using Shopify's stable payment attempt ID for idempotency. It builds the hosted URL from the session token and public key at `https://pay.edutecka.com/pay?token=...&pk=...`.

## Work required before production use

- Configure and verify Shopify's required mTLS trust chain and Payments Apps API access token/scopes.
- Replace the single-process JSON store with a shared transactional store before horizontal scaling.
- Confirm the hosted checkout's post-payment buyer return behavior with EDPay; the API schema currently offers no return URL.
- Complete applicable Shopify review, certification, and operational requirements.

## Documentation

- [Shopify payments app documentation](https://shopify.dev/docs/apps/build/payments)
- [EDPay API payments](https://docs-pay.edutecka.com/api/payments/)
- [EDPay webhooks](https://docs-pay.edutecka.com/api/webhooks/)
- [EDPay SDK integration guide](https://docs-pay.edutecka.com/sdks/)

## License

MIT. See [LICENSE](LICENSE).

## Official SDK repositories

- [JavaScript / TypeScript](https://github.com/edutecka/edpay-javascript-sdk)
- [Python](https://github.com/edutecka/edpay-python-sdk)
- [PHP](https://github.com/edutecka/edpay-php-sdk)
- [Java](https://github.com/edutecka/edpay-java-sdk)
- [.NET](https://github.com/edutecka/edpay-dot-net-sdk)

## Other official e-commerce plugin repositories

These are integration previews; consult each repository for its current implementation status and limitations.

- [WooCommerce (WordPress)](https://github.com/edutecka/edpay-woocommerce-plugin)
- [Magento / Adobe Commerce](https://github.com/edutecka/edpay-magento2-module)
- [PrestaShop](https://github.com/edutecka/edpay-prestashop-module)
- [OpenCart](https://github.com/edutecka/edpay-opencart-extension)
- [WHMCS](https://github.com/edutecka/edpay-whmcs-gateway)
- [Shopify](https://github.com/edutecka/edpay-shopify-app)
