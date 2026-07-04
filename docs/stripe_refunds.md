# Stripe refunds

Required environment variables:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

The admin app creates refunds from `business_order.STRIPE_PAYMENT_INTENT_ID`.
Webhook sync is not implemented here unless this app becomes the Stripe webhook owner.
