# Add ORDER_NUMBER to business_order

1. Run `docs/sql/add_order_number_to_business_order.sql` manually in MySQL Workbench.
2. If deleting old orders, delete `business_order_detail` first, then `business_order`.
3. If needed, reset `AUTO_INCREMENT` to `1` for `business_order`.
4. Run `npx prisma db pull`.
5. Run `npx prisma generate`.
6. Continue with next prompt.
