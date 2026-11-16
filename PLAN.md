# Roadmap and Architecture Plan - EDPay Shopify App

## Development Phases

### Phase 1: Architecture and Specification (Complete)
- [x] Define the hosted payment and offsite redirect flow.
- [x] Set `MZN` as the default currency.
- [x] Specify the checkout-session parameters.

### Phase 2: Integration Backend and Callback Signatures (In Progress)
- [ ] Node.js/TypeScript proxy server with Shopify HMAC-SHA256 verification.
- [ ] Redirect endpoint for EDPay Hosted Checkout.
- [ ] Return handler with Shopify `x_signature` verification.
- [ ] Define and implement foreign-currency conversion; the current client forwards the supplied currency and scales the amount by 100 without conversion.

### Phase 3: Validation and Release
- [ ] Submit the app to the Shopify App Store.
- [ ] Complete PCI DSS SAQ A compliance testing.
