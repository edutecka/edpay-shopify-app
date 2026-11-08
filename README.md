# EDPay Shopify Payments App

[![Shopify](https://img.shields.io/badge/Shopify-Hosted%20Payment%20SDK-blue.svg)](https://shopify.com)
[![Status](https://img.shields.io/badge/Status-Coming%20Soon-amber.svg)](https://edpay.co.mz)

Aplicativo oficial da **EDPay** para integração com lojas Shopify em Moçambique. Permite aos clientes pagarem as suas encomendas através de:
- Carteiras Móveis: **M-Pesa** (Vodacom) e **e-Mola** (Movitel)
- Cartões de Débito e Crédito: **Visa** e **Mastercard** com 3DS
- Carteiras Digitais: **Apple Pay** e **Google Pay**
- Referência Bancária: **Millennium BIM** / SIMO

---

## Arquitetura

O aplicativo utiliza o modelo **Offsite Redirect / Hosted Payment SDK** do Shopify. O comprador escolhe a EDPay no checkout do Shopify, é redirecionado para a página segura de pagamento alojada pela EDPay e, após autorização (ou inserção de PIN USSD), regressa automaticamente à página de confirmação de encomenda (`thank_you` page).

---

## Prazos e Condições Comerciais

- **Tarifa Unificada**: 6,00% em Meticais (MZN) sem custos fixos de adesão.
- **Liquidação Bancária**: Transferência bancária automática de 2 a 7 dias úteis.

---

## Suporte

- Documentação: [https://docs.edpay.co.mz/plugins/shopify](https://docs.edpay.co.mz/plugins/shopify)
- Engenharia: `dev@edutecka.com`
