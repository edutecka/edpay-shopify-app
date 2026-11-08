# Aplicação de Pagamentos EDPay para Shopify

[![Licença: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Shopify Payments](https://img.shields.io/badge/Shopify-Payments%20App-95BF47.svg)](https://shopify.com)
[![Multi-Gateway](https://img.shields.io/badge/EDPay-Multi--Gateway-0051FA.svg)](https://edpay.co.mz)

Aplicação backend oficial da **EDPay** baseada na API **Shopify Payments Apps (GraphQL)**, permitindo que lojistas da Shopify em Moçambique processem pagamentos em Meticais (MZN) através de **M-Pesa**, **e-Mola**, **Cartões Visa / Mastercard** e **Transferência Bancária**.

---

## 🏗️ Arquitetura

```
Shopify Checkout (Buyer)
    │
    ▼
POST /payment-session (EDPay Shopify Backend)
    │
    ├──> EDPay Core API (Gera link de checkout hospedado)
    │
    ▼
Cliente paga via M-Pesa / e-Mola / Cartão
    │
    ▼
Webhook EDPay (POST /webhook/edpay com HMAC-SHA256)
    │
    └──> GraphQL Mutation: paymentSessionResolve(id)
         └──> Shopify marca encomenda como Paga ("Paid")
```

---

## 🚀 Como Executar

### 1. Pré-requisitos
- Node.js 18+
- Conta de Parceiro Shopify (Shopify Partner Dashboard) com uma Payments Extension registrada.
- Conta de Comerciante na [EDPay](https://edpay.co.mz).

### 2. Configuração de Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:

```ini
PORT=3000
APP_URL=https://seu-servidor-edpay.com
EDPAY_PUBLIC_KEY=pk_live_...
EDPAY_PRIVATE_KEY=sk_live_...
EDPAY_WEBHOOK_SECRET=whsec_...
EDPAY_API_URL=https://api-pay.edutecka.com
SHOPIFY_API_KEY=shpa_...
SHOPIFY_API_SECRET=shpss_...
```

### 3. Instalação e Execução
```bash
npm install
npm start
```

---

## 🔗 Endpoints do Serviço

- `GET /health` — Monitoramento de integridade da aplicação.
- `POST /payment-session` — Endpoint chamado pelo Shopify Checkout para iniciar a cobrança.
- `POST /webhook/edpay` — Listener seguro para webhooks da EDPay (assinado via `X-EDPay-Signature`).

---

## 📄 Licença

MIT License. Consulte `LICENSE` para detalhes.
