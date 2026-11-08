# Roadmap & Plano de Arquitetura - EDPay Shopify App

## Fases de Desenvolvimento

### Fase 1: Arquitetura & Especificação (Concluído)
- [x] Definição do fluxo Hosted Payment SDK / Offsite Redirect.
- [x] Mapeamento de moedas base (`MZN`) e conversão para moedas estrangeiras.
- [x] Especificação de parâmetros do checkout session.

### Fase 2: Backend de Integração & Assinatura de Callbacks (Em Desenvolvimento)
- [ ] Servidor proxy em Node.js / TypeScript com verificação HMAC SHA-256 do Shopify.
- [ ] Endpoint de redirect para a EDPay Hosted Checkout.
- [ ] Handler de retorno com assinatura x_signature do Shopify.

### Fase 3: Homologação & Publicação
- [ ] Submissão do aplicativo na Shopify App Store.
- [ ] Testes de conformidade e segurança PCI-DSS SAQ-A.
