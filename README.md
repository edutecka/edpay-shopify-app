# EDPay Shopify payments integration preview

This repository contains an official integration preview (beta), not a production-ready Shopify payments app. The Node.js service can create an EDPay hosted payment link and receive an EDPay webhook, but it does not finish Shopify's payment-session flow.

> **Important limitation:** The webhook handler only logs that it would call Shopify's GraphQL `paymentSessionResolve`; it does not make that call or resolve/reject the payment session. Shopify request authentication, durable session/order mapping, and return/cancel handlers are also not implemented. Do not use this preview to accept live payments or treat a webhook acknowledgement as a completed Shopify payment.

## What the current service does

- `GET /health` returns a service health response.
- `POST /payment-session` expects an `id`, `amount`, `currency`, and optionally `customer.email`. It creates an EDPay hosted payment link and returns `{ "redirect_url": "..." }`.
- `POST /webhook/edpay` accepts an EDPay webhook and checks its signature only when a webhook secret is configured. A successful payment event is logged, but is not resolved with Shopify.

The payment-session handler delegates payment-method choice to the hosted EDPay link; the incoming `payment_method` value is not currently used. The service generates `/shopify/return` and `/shopify/cancel` URLs from `APP_URL`, but this repository does not implement those routes.

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
APP_URL=https://your-public-test-host.example
EDPAY_API_URL=https://api-pay.edutecka.com
EDPAY_PUBLIC_KEY=pk_test_...
EDPAY_PRIVATE_KEY=sk_test_...
EDPAY_WEBHOOK_SECRET=your_webhook_secret
```

Partner API requests use the `X-EDPay-Public-Key` and `X-EDPay-Private-Key` headers. The implementation defaults `EDPAY_API_URL` to `https://api-pay.edutecka.com`; set it explicitly if your authorized environment uses another EDPay API URL. Set a webhook secret: the current verifier accepts every signature when the secret is absent.

The server does not load `.env` automatically. In a POSIX shell, export those values before starting it:

```bash
set -a
. ./.env
set +a
npm run dev
```

The development script runs `node --watch server/index.js`. For a non-watch start, use `npm start` in the same environment.

## Example payment-session request

For local integration testing only, send the fields consumed by the current handler:

```bash
curl -X POST "http://localhost:3000/payment-session" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-session-10492",
    "amount": 500.00,
    "currency": "MZN",
    "customer": { "email": "customer@example.com" }
  }'
```

The service returns a `redirect_url` from the EDPay payment-link response. This endpoint is a development scaffold, not a Shopify-authenticated or Shopify-certified endpoint. Do not expose it as a live Shopify payment integration.

## Work required before production use

- Implement Shopify request authentication and validate payment-session payloads.
- Resolve and reject/cancel payment sessions using Shopify's Payments Apps GraphQL API.
- Persist idempotency and session-to-order mappings; handle duplicate events and failures safely.
- Implement and secure return/cancel handling, and add automated security and integration tests.
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
