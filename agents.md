# Foodeez Admin Panel Agent Notes

## Project Overview

This repository is the Foodeez admin panel for managing restaurants and their product/menu catalog. It is a Next.js App Router application using TypeScript, Prisma, MySQL/MariaDB, NextAuth credentials login, Tailwind CSS, Radix UI primitives, and a local shadcn-style component library.

Primary stack:

- Next.js App Router with React client components where interactive state is needed.
- TypeScript throughout the app and component layers.
- Prisma v7 with a generated client in `prisma/generated/prisma`.
- MySQL/MariaDB through `@prisma/adapter-mariadb`.
- NextAuth credentials authentication.
- Tailwind CSS v4 with Foodeez theme tokens in `src/app/globals.css`.
- Radix UI primitives, `class-variance-authority`, `tailwind-merge`, and `lucide-react`.
- S3-compatible media upload/storage through `src/lib/s3-storage.ts`.

Important folders:

- `src/app`: App Router pages, layouts, and API route handlers.
- `src/app/dashboard`: root business selector dashboard.
- `src/app/dashboard/[businessId]`: selected-business dashboard layout and pages.
- `src/app/api`: route handlers for auth, upload, products, categories, and tags.
- `src/components/ui`: shared shadcn-style UI primitives.
- `src/components/admin`: Shopify-inspired selected-business admin shell, sidebar, mobile drawer, and header.
- `src/components/core`: shared app chrome such as navbars, footers, breadcrumb, profile, loading.
- `src/components/dashboard`: selected-business dashboard cards.
- `src/components/menu`: selected-business Menu Cards management client UI.
- `src/components/orders`: selected-business Orders management client UI.
- `src/components/products`: product, category, tag tables/forms/actions.
- `src/components/providers`: app-wide React providers for auth and selected business context.
- `src/lib`: Prisma, auth, media, upload, S3, and utility helpers.
- `src/services`: server helpers for dashboard/business/menu/order/settings data. `src/services/admin-data.ts` owns root dashboard data, selected-business dashboard data, and the current products server actions. `src/services/menu-management.ts` owns the dashboard-scoped Menu Card, Product, Category, and Tag API logic, including ownership checks, relationship shaping, counts, filtering, pagination, ordering, preview shaping, and soft deletes where applicable. `src/services/orders-management.ts` owns Orders management filtering, KPI aggregation, detail shaping, ownership checks, and status transitions. `src/services/settings-management.ts` owns business settings reads/upserts.
- `prisma`: Prisma schema, generated Prisma client output, SQL view files, and hand-created SQL migrations under `prisma/migrations`.
- `public`: logos, SVGs, and static images.

## Database Schema

Schema details are intentionally not duplicated here. Use `prisma/schema.prisma` as the source of truth for database models, views, fields, attributes, and relations.

Fulfillment/order notification schema changes are tracked in the hand-created migration `prisma/migrations/20260625030000_add_fulfillment_orders_notifications/migration.sql`. Do not run `prisma migrate` for that file unless the workflow is intentionally changed; apply it manually, then run `npx prisma db pull` and `npx prisma generate`.

Menu card weekday scheduling started from the manual SQL file `docs/sql/menu_card_weekday_schedule.sql`. After applying it in MySQL Workbench, run `npx prisma db pull` and `npx prisma generate` so `prisma/schema.prisma` and the generated client include `REPEAT_WEEKLY`, `ACTIVE_DAYS_JSON`, and `IS_UNLIMITED`.

Stripe refund support uses the existing `business_order` table fields added by `docs/sql/add_stripe_order_payment_fields_admin_check.sql`: `STRIPE_CHECKOUT_SESSION_ID`, `STRIPE_PAYMENT_INTENT_ID`, `STRIPE_REFUND_ID`, `STRIPE_REFUND_STATUS`, and `STRIPE_REFUNDED_DATETIME`. After applying that SQL in another environment, run `npx prisma db pull` and `npx prisma generate`.

Official Foodeez display order numbers use `business_order.ORDER_NUMBER`, added by `docs/sql/add_order_number_to_business_order.sql`. `BUSINESS_ORDER_ID` remains the internal numeric database ID and must not be replaced or converted into the public display key.

## Route Map

Existing pages:

- `/`: public root page from `src/app/page.tsx`.
- `/auth/signin`: credentials sign-in page.
- `/auth/forgot-password`: forgot-password page.
- `/auth/reset-password`: reset-password page.
- `/dashboard`: authenticated business-owner landing page. It is now a server-rendered Shopify-style business selector that resolves owned businesses and shows business cards with logo/avatar, status badge, and a "Go to Dashboard" link.
- `/dashboard/[businessId]`: selected-business overview page inside `AdminShell`. It is server-rendered and shows KPI cards for total orders, total revenue, pending orders, and active products, followed by a recent-orders table.
- `/dashboard/[businessId]` and nested selected-business routes are wrapped by `src/app/dashboard/[businessId]/layout.tsx`, which now renders the shared admin shell instead of the older public navbar/footer chrome.
- `/dashboard/[businessId]/orders`: selected-business Orders management page. It renders KPI cards, status/date/search filters, a paginated orders table, row actions, and an order detail modal through `AdminOrdersPage`.
- `/dashboard/[businessId]/menu`: selected-business Menu Cards management page. It server-fetches menu cards through `menu-management.ts` and hydrates `MenuCardsManagement` for status tabs, 3-column desktop card grid, create/edit modal, duplicate, delete, and Manage links.
- `/dashboard/[businessId]/menu/[cardId]`: selected-business Menu Card detail workspace. It server-fetches the menu card workspace through `menu-management.ts` and hydrates `MenuCardDetailManagement` for draft category assignment, drag reorder, remove, explicit Save/Discard, expandable product preview, and customer preview modal.
- `/dashboard/[businessId]/menu/products`: selected-business product catalog workspace. It server-fetches products/categories and hydrates `AdminProductsTable` for image thumbnails, search, category filtering, sortable table columns, add/edit modal, active/inactive toggle, delete, empty state, and loading skeleton.
- `/dashboard/[businessId]/menu/products/new`: add product form.
- `/dashboard/[businessId]/menu/products/[productId]/edit`: edit product form.
- `/dashboard/[businessId]/menu/categories`: selected-business category management workspace. It server-fetches categories through `menu-management.ts` and hydrates `CategoryTable` for add/edit modal, tag assignment, product counts, status badges, soft delete, and empty state.
- `/dashboard/[businessId]/menu/categories/new`: add category form.
- `/dashboard/[businessId]/menu/categories/[categoryId]/edit`: edit category form.
- `/dashboard/[businessId]/menu/tags`: selected-business tag management workspace. It server-fetches tags through `menu-management.ts` and hydrates `TagsTable` for add/edit modal, product/category counts, status badges, soft delete, and empty state.
- `/dashboard/[businessId]/settings`: selected-business settings workspace. It server-fetches business info, legacy delivery-area settings, and fulfillment settings, then hydrates `AdminSettingsForm` for Shopify-style local delivery zones, pickup/default prep settings, legacy comma-separated delivery areas, and read-only business info.
- Legacy standalone product/category route files were removed after moving menu functionality into the `/menu/...` structure.

Existing API routes:

- `/api/auth/[...nextauth]`: NextAuth route.
- `/api/auth/forgot-password`: forgot-password handler.
- `/api/auth/reset-password`: reset-password handler.
- `/api/upload`: authenticated image upload route.
- `/api/products`: legacy product CRUD route with business-owner authorization. Current selected-business menu UI should prefer the dashboard-scoped product routes below.
- `/api/categories`: legacy category CRUD route with business-owner authorization. Current selected-business menu UI should prefer the dashboard-scoped category routes below.
- `/api/tags`: legacy tag CRUD route with business-owner authorization. Current selected-business menu UI should prefer the dashboard-scoped tag routes below.
- `/api/dashboard/[businessId]/products`: authenticated selected-business Product list/create route. Supports search, category, status, page, and pageSize filters. Returns paginated product rows with tag/category shaping plus pricing, inventory, weight, and image fields.
- `/api/dashboard/[businessId]/products/[id]`: authenticated selected-business Product update/delete route. `PATCH` updates full product data, including `COST_PRICE`, `COMPARE_AS_PRICE`, inventory fields, `WEIGHT`, `WEIGHT_UNIT`, `PIC`, or status-only payloads; `DELETE` soft-deletes by status.
- `/api/dashboard/[businessId]/categories`: authenticated selected-business Category list/create route. Returns category rows with tags and inferred product counts.
- `/api/dashboard/[businessId]/categories/[id]`: authenticated selected-business Category update/delete route. Maintains `business_product_category_2_tag` assignments and soft-deletes by status.
- `/api/dashboard/[businessId]/tags`: authenticated selected-business Tag list/create route. Returns tag rows with product/category counts.
- `/api/dashboard/[businessId]/tags/[id]`: authenticated selected-business Tag update/delete route. `DELETE` soft-deletes the tag and removes bridge-table assignments.
- `/api/dashboard/[businessId]/menu-cards`: authenticated selected-business Menu Card list/create route. `GET` returns all non-deleted cards with category count, product count, status, computed availability, date range, `repeatWeekly`, `activeDays`, and `isUnlimited`. `POST` creates a card or duplicates an existing card when given `duplicateFromId`; duplicate preserves weekday scheduling fields.
- `/api/dashboard/[businessId]/menu-cards/[cardId]`: authenticated selected-business Menu Card update/delete route. `PATCH` updates title, date range, enabled status, weekly repeat fields, active days, and daily unlimited state. `DELETE` removes the card and its bridge detail rows.
- `/api/dashboard/[businessId]/menu-cards/[cardId]/details`: authenticated selected-business Menu Card detail list/create route. `GET` returns assigned categories, available categories, and read-only products from the menu-card detail view. `POST` assigns a category to the card.
- `/api/dashboard/[businessId]/menu-cards/[cardId]/details/[detailId]`: authenticated selected-business Menu Card detail delete route. `DELETE` removes a category assignment from the card.
- `/api/dashboard/[businessId]/menu-cards/[cardId]/details/reorder`: authenticated selected-business Menu Card detail reorder route. `PATCH` accepts `[ { detailId, displayOrder } ]`.
- `/api/dashboard/[businessId]/orders`: authenticated selected-business Orders list route. Supports `status`, `dateFrom`, `dateTo`, `search`, `page`, and `limit`. Search accepts the public `ORDER_NUMBER`/`FDZ.000001` value, the numeric internal ID, customer name, email, or phone. It returns top-level `{ orders, totalCount, page, totalPages, kpi, prepDefaults }`. Order rows include `ORDER_NUMBER`/`displayOrderNumber`, customer fields aliased as `VISITOR_*`, order type, payment mode/status, `FINAL_AMOUNT`, financial summary values, `CREATION_DATETIME`, `DELIVERY_ET`, `ETA_ACKNOWLEDGED_DATETIME`, rejection fields, optional `STAFF_MEMBER`/`TERMINAL`, `item_count`, and all detail rows joined to `business_product` as `product_title`.
- `/api/dashboard/[businessId]/orders/[orderId]/status`: authenticated selected-business order status update route. Accepts status transitions for delivery (`out_for_delivery`, `delivered`, `rejected`) and pickup (`ready_for_pickup`, `picked_up`, `rejected`), validates ownership, enforces lifecycle transitions, collects rejection reason/note, finalizes/releases inventory where applicable, and creates a Stripe refund before rejecting paid Stripe/card orders. Delivered/picked-up status changes do not automatically mark unpaid cash orders paid.
- `/api/dashboard/[businessId]/orders/[orderId]/eta`: authenticated selected-business ETA update route. `PATCH` accepts `{ eta: string }`, validates ownership, sets `DELIVERY_ET`, and marks `ETA_ACKNOWLEDGED_DATETIME`.
- `/api/dashboard/[businessId]/orders/[orderId]/payment`: authenticated selected-business payment update route. `PATCH` accepts `{ paymentDone: 1 }` only, validates ownership, and marks `PAYMENT_DONE = 1`; arbitrary payment-state writes are rejected.
- `/api/dashboard/[businessId]/orders/[orderId]/refund`: authenticated selected-business Stripe refund route. It validates ownership, requires paid Stripe/card payment with `STRIPE_PAYMENT_INTENT_ID`, avoids duplicate refunds when refund fields already exist, creates a full refund through Stripe using `STRIPE_SECRET_KEY`, stores refund id/status/date and `ORDER_REFUND_AMOUNT`, and marks `PAYMENT_DONE = 2` only when Stripe reports `succeeded`.
- `/api/dashboard/[businessId]/notifications`: authenticated selected-business notification list route. Supports `unreadOnly=true/false` and `limit`, removes expired rows, returns newest first plus unread count.
- `/api/dashboard/[businessId]/notifications/[notificationId]/read`: authenticated selected-business notification read route. Marks one notification as read after owner access validation.
- `/api/dashboard/[businessId]/notifications/read-all`: authenticated selected-business notification bulk read route. Marks all notifications for the business as read.
- `/api/dashboard/[businessId]/settings`: authenticated selected-business settings route. `GET` returns delivery-area settings; `POST` upserts normalized delivery areas.
- `/api/dashboard/[businessId]/settings/fulfillment`: authenticated selected-business fulfillment settings route. `GET` returns parsed `DELIVERY_ZONES_JSON` plus pickup/default prep settings. `PATCH` validates owner access, normalizes postal codes, validates CHF prices/free-delivery thresholds, stores zones as JSON text, and updates `LAST_UPDATE_DATETIME`.
- `/api/businesses/[businessId]/fulfillment-options`: public customer-facing fulfillment options route. Returns delivery/pickup enabled flags, pickup instructions, and default prep minutes.
- `/api/businesses/[businessId]/delivery-quote`: public customer-facing delivery quote route. Uses `src/lib/fulfillment.ts` to match exact postal codes and wildcard prefix postal codes from `DELIVERY_ZONES_JSON`.
- `/api/businesses/[businessId]/orders`: public customer-facing order creation route. Computes product subtotal server-side from active business products, validates delivery quotes for delivery orders, stores pickup orders without delivery fees, and writes `business_order` plus detail rows.
- `/api/businesses/[businessId]/orders` also reserves tracked product inventory inside the same Prisma transaction as order/detail creation. If `TRACK_INVENTORY = 1` and `INVENTORY_AVAILABLE` is below the requested quantity, it rejects creation with `Only X left in stock for PRODUCT_TITLE`. New orders save `ORDER_NUMBER` as the official display number in `FDZ.000001` format after the numeric `BUSINESS_ORDER_ID` is known, and responses include `orderNumber`/`ORDER_NUMBER`.

Planned or visible-coming-soon areas:

- Low-stock threshold logic is intentionally not implemented in the current product inventory workflow.

## Production Runtime Notes

- `src/lib/prisma.ts` uses one MariaDB connection per serverless instance and caches the Prisma singleton in every environment; do not increase the pool without production evidence.
- Routine JWT session reads must not query the database. Server authorization still verifies business ownership through `requireBusinessAccess`.
- Manual production query indexes live in `docs/sql/add_production_query_indexes.sql`. Apply them manually, then run `prisma db pull` and `prisma generate`; do not use `prisma migrate` for this file.
- Keep polling focused to orders and notifications, pause it in hidden tabs, and do not restore a global dashboard `router.refresh()` interval.

## Coding Conventions

General:

- Use App Router file conventions: `page.tsx`, `layout.tsx`, and `route.ts`.
- Use absolute imports through the `@/` alias.
- Keep route-specific UI in `src/app/...`; reusable UI belongs under `src/components/...`.
- Prefer existing UI primitives from `src/components/ui` before adding new component styles.
- Interactive pages and components use `"use client"` at the top.
- Server helper functions live in `src/services/HelperFunctions.ts` and use `"use server"`.
- Shared utilities live in `src/lib`.

Data and API patterns:

- Import Prisma from `@/lib/prisma`.
- Prefer server components and server-side data fetching for dashboard/admin pages where possible.
- `src/services/admin-data.ts` contains selected-business ownership checks, root business selector data, dashboard KPI/recent-order data, product catalog data, and product server actions with `revalidatePath`.
- `src/services/menu-management.ts` contains dashboard-scoped Menu Card, Product, Category, and Tag list/create/update/delete behavior shared by the menu API routes and server pages.
- `src/services/orders-management.ts` centralizes Orders management logic, including business-owner authorization, status mapping, list filtering, KPI calculation, order detail rows, and status transition validation.
- `src/services/settings-management.ts` centralizes business info and delivery-area settings reads/upserts.
- Route handlers return `NextResponse.json(...)`.
- API routes validate required fields and return `{ error: string }` with appropriate status codes.
- Authenticated API routes call `getServerSession(authOptions)`.
- Business-scoped mutations verify that the current visitor account maps to a business owner and that the owner has access to the target business.
- Multi-table writes and association updates use `prisma.$transaction`.
- Product and category tag associations are updated transactionally.
- Categories are related to tags through `business_product_category_2_tag`; products are related to tags through `business_product_2_tag`.
- Product/category/tag deletes in the dashboard-scoped menu APIs are soft deletes through status values. Current menu queries exclude status `-1`; active/inactive use status `1`/`0`.
- Menu Card status is separate from date availability. `STATUS = 1` means enabled, `STATUS = 0` means disabled, and date range determines Active/Scheduled/Expired availability. Do not show both Active and Inactive badges for the same card; disabled cards should show only Inactive in the admin list.
- Multiple menu cards can be active for the same business and overlapping date ranges are valid. Do not add uniqueness constraints across `BUSINESS_ID`, `VALID_FROM`, or `VALID_TO`.
- Menu Card weekday scheduling uses `business_food_menu_card.REPEAT_WEEKLY`, `ACTIVE_DAYS_JSON`, and `IS_UNLIMITED`. `ACTIVE_DAYS_JSON` is app-owned JSON text containing lowercase weekday keys such as `["monday","tuesday","friday"]`.
- `src/services/menu-management.ts` normalizes menu card scheduling payloads. Daily unlimited forces `IS_UNLIMITED = 1`, `REPEAT_WEEKLY = 1`, `VALID_TO = NULL`, and `ACTIVE_DAYS_JSON = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]`; the menu stays active forever until the restaurant sets `STATUS` inactive.
- Weekday repeat behavior treats `REPEAT_WEEKLY = 1` as recurring weekly on the selected weekdays in `ACTIVE_DAYS_JSON`. At least one active day is required when repeat weekly or daily unlimited is enabled. When repeat weekly is disabled, `ACTIVE_DAYS_JSON` is saved as `NULL` and the menu follows only date range plus status.
- Admin menu-card availability is active today only when `STATUS` is active, today is on/after `VALID_FROM`, `VALID_TO` is null/unlimited/not past, and today's weekday is inside `ACTIVE_DAYS_JSON` when `REPEAT_WEEKLY = 1`. Keep this admin calculation aligned with any future customer-facing view SQL updates.
- Keep date/status behavior compatible with existing menu card availability, and do not enforce one active menu per business.
- Menu Card category changes in `MenuCardDetailManagement` are draft-first. Add, remove, and drag reorder update local UI only until the owner clicks Save Changes; Discard reloads the saved workspace.
- Menu Card preview products come from `business_food_menu_card_detail_view` and are read-only. Customer-facing menu-card views should filter to enabled cards (`STATUS = 1`) and enabled detail rows.
- Image replacement/deletion paths clean up old S3 objects through `S3Storage`.
- Client forms call API routes with `fetch`, JSON bodies, and local loading/error state.
- Product catalog interactions in `AdminProductsTable` use server actions from `admin-data.ts` for save, toggle status, and soft delete. Category and tag tables use the dashboard-scoped menu API routes.
- Product create/update logic must save `business_product.COST_PRICE`, `PRODUCT_PRICE`, `COMPARE_AS_PRICE`, `TRACK_INVENTORY`, `INVENTORY_ON_HAND`, `INVENTORY_AVAILABLE`, `INVENTORY_COMMITED`, `WEIGHT`, `WEIGHT_UNIT`, and `PIC` through both the current `admin-data.ts` server-action path and the dashboard-scoped product API path in `menu-management.ts`.
- Product prices are CHF and must be `>= 0`. `PRODUCT_PRICE` is required, `COST_PRICE` is internal admin-only, and `COMPARE_AS_PRICE` should be greater than `PRODUCT_PRICE` when set above zero.
- Product inventory tracking uses `TRACK_INVENTORY = 1` only when the owner checks "Track inventory for this product". When unchecked, save `TRACK_INVENTORY = 0` and set `INVENTORY_ON_HAND`, `INVENTORY_AVAILABLE`, and `INVENTORY_COMMITED` to `0`. When checked, owners edit on-hand stock and the backend recalculates `INVENTORY_AVAILABLE = max(INVENTORY_ON_HAND - INVENTORY_COMMITED, 0)`.
- Order inventory writes live in `src/lib/inventory.ts`. On order creation, tracked products reserve stock by decrementing `INVENTORY_AVAILABLE` and incrementing `INVENTORY_COMMITED` by `ORDER_QUANTITY`; untracked products do not change stock.
- Admin order status updates call inventory helpers inside the same Prisma transaction as the `business_order` status update. Transitioning into delivered (`ORDER_STATUS = 3`) or picked up (`ORDER_STATUS = 6`) finalizes tracked stock by decrementing `INVENTORY_COMMITED` and `INVENTORY_ON_HAND`, while leaving `INVENTORY_AVAILABLE` unchanged from reservation; it does not automatically mark unpaid cash orders paid. Transitioning into rejected (`ORDER_STATUS = 4`) releases tracked stock by incrementing `INVENTORY_AVAILABLE` and decrementing `INVENTORY_COMMITED`, without changing `INVENTORY_ON_HAND`.
- Inventory lifecycle updates rely on the existing status transition guard in `src/lib/orderStatus.ts` to avoid double finalization or double release. Helper math clamps counts so legacy/manual data cannot push `INVENTORY_ON_HAND` or `INVENTORY_COMMITED` below zero.
- Product weight uses `WEIGHT` plus `WEIGHT_UNIT`; allowed units in the admin form are `gm`, `kg`, `ml`, and `l`, defaulting to `0 gm`.
- Orders management uses API routes from the `AdminOrdersPage` client island because it needs filter/search pagination and modal-driven status updates.
- Current order status mapping is `preparing = 1`, `out_for_delivery = 2`, `delivered = 3`, `rejected = 4`, `ready_for_pickup = 5`, and `picked_up = 6`. Valid delivery transitions are `preparing -> out_for_delivery`, `out_for_delivery -> delivered`, and `preparing -> rejected`. Valid pickup transitions are `preparing -> ready_for_pickup`, `ready_for_pickup -> picked_up`, and `preparing -> rejected`.
- `business_order.ORDER_TYPE` distinguishes fulfillment mode. Allowed app values are `delivery` and `pickup`; default existing orders to `delivery`.
- Do not add a separate payment-status column. Use `business_order.PAYMENT_DONE` with `0 = pending/unpaid`, `1 = paid`, `2 = refunded`, and `3 = failed`.
- Admin payment labels are derived from `PAYMENT_DONE` plus `ORDER_TYPE`: `1 = Paid`, delivery `0 = Cash on delivery`, pickup `0 = Cash on pickup`, `2 = Refunded`, and `3 = Payment failed`. Restaurant operators mark real-life cash payments paid from the order details modal through `/payment`.
- Use `business_order.DELIVERY_ET` for both estimated delivery time and estimated pickup time. Use `ETA_ACKNOWLEDGED_DATETIME` when the business owner confirms the ETA was seen/accepted.
- Use `src/lib/orderNumber.ts` for visible order numbers. `formatOrderNumberFromId`, `generateOrderNumberFromId`, and `getDisplayOrderNumber` all produce or resolve the official `FDZ.000001` display format, with `ORDER_NUMBER` preferred and `BUSINESS_ORDER_ID` used only as the fallback for old rows.
- Use `src/lib/eta.ts` for admin/customer ETA display. `formatEtaTimeOnly` and `getDisplayEta` must display time only, for example `20:20`, never an ETA date in frontend/admin UI. Dates can still be used internally for backend calculation and `datetime-local` editing.
- Rejected orders can store structured admin context in `ORDER_REJECTION_REASON`, `ORDER_REJECTION_NOTE`, and `REJECTED_DATETIME`.
- `src/lib/orderStatus.ts` is the shared source for order status constants, payment constants, labels, badge colors, allowed actions, Stripe/card-paid detection, and transition validation. Use it in admin/dashboard code instead of hand-mapping status numbers.
- Stripe/card-paid orders with `PAYMENT_DONE = 1` must be refunded before rejection. `updateOrderStatus` calls the shared refund logic first; if Stripe refund creation fails or `STRIPE_PAYMENT_INTENT_ID` is missing, the order stays unchanged. COD/cash/pay-at-pickup unpaid orders reject without a Stripe refund.
- Stripe refunds are full-order refunds based on `ORDER_FINAL_AMOUNT`, converted to cents without floating-point multiplication. A `pending` Stripe refund stores `STRIPE_REFUND_STATUS` but keeps `PAYMENT_DONE = 1`; a `succeeded` refund sets `PAYMENT_DONE = 2`. Refund/reject actions are owner-initiated admin actions and must not create admin `business_notification` rows; customer-facing refund/rejection notifications belong in the separate `foodeez.ch` customer app.
- Dashboard and Orders revenue KPIs use `countsAsRevenue` from `src/lib/orderStatus.ts`; rejected orders, refunded/failed payments, and orders with `STRIPE_REFUND_STATUS` do not count toward revenue totals.
- Orders list filtering must not apply a default date range. The default route/UI state should show all existing orders unless `dateFrom`/`dateTo` are explicitly supplied.
- `src/services/orders-management.ts` logs the raw Prisma `where` clause and distinct raw `ORDER_STATUS` values in development mode; keep that logging when working on order data bugs.
- Order status, rejection, ETA, payment, and refund mutations create idempotent `customer_order_notification` events inside the same database transaction as the order write. Notification ownership uses `VISITORS_ACCOUNT_ID` (sourced from `business_order.VISITOR_ID`). Keep event keys and snapshot metadata compatible with `foodeez.ch/frontend/src/lib/customer-notifications.ts`; the customer app owns listing and read state.
- The selected-business dashboard recent-orders table uses the same order status mapping through `src/services/admin-data.ts`; `ORDER_STATUS = 4` means rejected.
- `business_settings.DELIVERY_RANGE_ZIP_CODES` is retained for backward compatibility. New delivery-zone work should prefer `DELIVERY_ZONES_JSON`, with `DELIVERY_ENABLED`, `PICKUP_ENABLED`, `PICKUP_INSTRUCTIONS`, `DEFAULT_PICKUP_PREP_MINUTES`, and `DEFAULT_DELIVERY_PREP_MINUTES` for fulfillment settings.
- Customer-facing fulfillment calculations belong in `src/lib/fulfillment.ts`. Reuse `calculateDeliveryQuote` for checkout and public quote APIs so delivery availability, free delivery, and minimum-order behavior stay identical.
- Checkout order creation sets `ORDER_TYPE` to `delivery` or `pickup`, `ORDER_STATUS = 1`, `DELIVERY_ET = null`, and `ETA_ACKNOWLEDGED_DATETIME = null`. Delivery orders require `ADDRESS_ZIP`, validate it through `calculateDeliveryQuote`, and include `SHIPPING_CHARGES` in `ORDER_FINAL_AMOUNT`; pickup orders use `SHIPPING_CHARGES = 0`.
- Checkout order creation must keep `BUSINESS_ORDER_ID` as the internal numeric ID, generate the public `ORDER_NUMBER` from that ID as `FDZ.` plus a 6-digit padded serial, and keep `business_order_detail.BUSINESS_ORDER_ID` pointing to the numeric internal ID.
- Payment state stays in `PAYMENT_DONE`: Stripe orders are saved as `1`; cash on delivery and pay-at-pickup orders start as `0`.
- Business notifications live in `business_notification` and are scoped by `BUSINESS_ID`. Allowed app values for `NOTIFICATION_TYPE` are `order`, `refund`, `system`, `menu`, and `payment`; notification payload extras belong in `METADATA_JSON`.
- `src/lib/businessNotifications.ts` owns admin notification creation. New checkout orders create an `order` notification with a dashboard orders link and order metadata. Owner-initiated refund/reject actions should not create admin notifications.
- Admin notification UI derives order display text from `METADATA_JSON.orderNumber` when present and falls back to formatting `metadata.orderId` through `formatOrderNumberFromId`, so even old order notifications should display `FDZ.000001` rather than raw numeric IDs.

Naming:

- React components use PascalCase file and function names.
- Hooks use `use...` naming, for example `useBusinessId`, `useSetBusinessId`, and `useClearBusinessId`.
- Client-facing form payloads commonly use lower camel/snake names such as `businessId`, `product_price`, `tag_ids`, and `updateImageOnly`, then map to database fields in route handlers.

Styling:

- Use Tailwind utility classes.
- Reuse Foodeez brand tokens such as `foodeez-primary`, `foodeez-secondary`, and `foodeez-accent`.
- UI components use `cn` from `src/lib/utils.ts` for class composition.
- Variant-based primitives use `class-variance-authority`, as in `src/components/ui/button.tsx`.
- Responsive layouts commonly use mobile card views and desktop tables.

State and context:

- `AuthProvider` and `BusinessProvider` wrap the app in `src/app/layout.tsx`.
- Selected business state is managed by `BusinessProvider` and persisted under `foodeez_business_id` in localStorage.
- Dashboard pages read selected business state with `useBusinessId`.
- Root dashboard sets selected business state when a user clicks a business card.
- `AdminShell` receives the route `businessId` from `src/app/dashboard/[businessId]/layout.tsx` and syncs it into `BusinessProvider`, so nested selected-business pages can continue reading `useBusinessId`.

## Component Patterns

Shared UI components:

- `src/components/ui` contains reusable primitives built around Radix UI and local Tailwind styling.
- Components expose typed props and forward standard HTML props where practical.
- Common primitives include buttons, cards, tables, dialogs, dropdowns, tabs, inputs, labels, textarea, badges, avatar, skeleton, alerts, sheets, selects, switches, and upload fields.
- `ImageUploadField` is the shared image picker/preview control used by product/category forms.
- `ImageUploadField` supports pasted image URLs and file selection. Product forms save the resolved URL/key through `business_product.PIC`; invalid or empty image URLs should render the placeholder preview instead of a broken image.

Core layout components:

- `AdminShell` is the shared selected-business dashboard wrapper. It composes the fixed desktop sidebar, mobile drawer trigger, sticky admin header, and padded scrollable content area.
- `AdminSidebar` renders the selected business identity at the top, including logo/initials avatar, business name, status label when available, and a full-width Switch Business link to `/dashboard`.
- `AdminSidebar` navigation order is Dashboard, Orders, collapsible Menu group, then Settings. The Menu group auto-expands on `/menu` routes and contains Menu Cards, Products, Categories, and Tags with indented child links and a left accent border.
- `AdminSidebar` footer renders the authenticated owner from NextAuth session data, including profile image when available or an initials avatar, truncated owner name, and logout action.
- `AdminMobileDrawer` provides the hamburger-triggered slide-in navigation on small screens, reusing the sidebar nav items with visible labels and closing on outside click or Escape. The mobile drawer uses a fixed full-height panel and fixed backdrop.
- `AdminHeader` auto-generates breadcrumbs and the page title from route segments. It includes a static notification button and a Quick Actions dropdown linking to new product, new category, and orders routes.
- `AdminHeader` auto-generates breadcrumbs and the page title from route segments. It includes the business notification bell/dropdown with unread count, 30-second polling, mark-read behavior, browser Notification API prompts, and a Quick Actions dropdown linking to new product, new category, and orders routes.
- `Navbar` and `Footer` are no longer used by the selected-business layout; they may still be used by public or other non-admin surfaces.
- `DashboardNavbar`, `DashboardFooter`, and `DashboardBreadcrumb` are used by the root dashboard.
- `LoadingSpinner` and skeletons provide loading states.

Dashboard components:

- `BusinessInfoCard` renders selected business details.
- `StatsCard` renders linked dashboard metric cards.
- The selected-business dashboard page now renders KPI cards and recent orders directly as a server component rather than using client-side dashboard data loading.

Menu-card-management components:

- `MenuCardsManagement` is the current selected-business menu-card list UI for `/dashboard/[businessId]/menu`. It owns client-side status tab filtering, create/edit modal state, duplicate/delete actions, daily unlimited/repeat weekly toggles, weekday chips, and renders one status badge per card: Inactive for disabled cards, otherwise Active/Scheduled/Expired from computed availability. Cards also show Daily unlimited and Repeat weekly badges, selected weekday chips, date range, category count, product count, and Manage.
- `MenuCardDetailManagement` is the selected-business menu-card detail client island for `/dashboard/[businessId]/menu/[cardId]`. It owns local draft state for available categories, assigned categories, removals, drag order, Save Changes, Discard, expanded category rows, and the customer preview modal.
- Menu cards contain categories through `business_food_menu_card_detail`; categories contain products indirectly through the existing category-tag and product-tag inference. Do not add a direct product assignment table for menu cards.

Product-management components:

- `AdminProductsTable` is the current Shopify-style product catalog UI for `/dashboard/[businessId]/menu/products`. It receives server-fetched rows and category options, then handles search, category filter, sorting, add/edit modal, status toggle, and delete as a client island. The table shows image thumbnail, product name, inferred category, selling price, compare-at price when set, stock status, status, and actions.
- The current product form uses `ProductForm` inside the admin modal and legacy add/edit pages. Its product details, pricing, inventory, weight, image, and tags sections must stay consistent across those surfaces. Cost price helper text is "Cost price is only visible to your business." Compare-at helper text is "Compare-at price appears as a strikethrough price on the customer menu."
- Product images use the real schema field `business_product.PIC`, mapped by `src/services/admin-data.ts` to `AdminProductRow.imageUrl`. Product table thumbnails should use that `imageUrl` alias with `resolveMediaUrl`, rounded 40-48px object-cover display, product-title alt text, and a placeholder fallback.
- Product category display/filtering in `AdminProductsTable` is inferred from overlapping product tags and category tags because `business_product` does not have a direct category foreign key.
- `CategoryTable` and `TagsTable` are current selected-business client islands for category/tag management and expect server-provided rows from `menu-management.ts`.
- `ProductTable`, `DeleteProductModal`, and the legacy root `/api/products` flows remain older product-management surfaces; prefer `AdminProductsTable` and dashboard-scoped APIs for current selected-business work.
- `ProductForm` and `CategoryForm` are reusable add/edit forms controlled by a `mode` prop and `initialValues`.
- `ProductForm` can receive `categoryOptions`; category assignment is implemented by adding the selected category's tags to the product's tag assignments.
- `TagSelect` is used by product/category forms to attach tags and loads tags from `/api/dashboard/[businessId]/tags`.
- `TagFilter` filters product lists by selected tags.
- Add/edit pages are thin wrappers around the reusable forms and API calls.

Settings components:

- `AdminSettingsForm` is the selected-business settings client island. It edits fulfillment settings through `/api/dashboard/[businessId]/settings/fulfillment`, including delivery enabled, delivery zones, pickup enabled, prep-time defaults, and pickup instructions. It also preserves the legacy comma-separated delivery areas editor through `/api/dashboard/[businessId]/settings` and renders read-only business name/email fields.

Orders-management components:

- `AdminOrdersPage` is the Shopify-style Orders UI for `/dashboard/[businessId]/orders`. It owns client-side filter state, pagination state, row action dropdowns, payment/ETA updates, and the order detail modal.
- Orders list, status changes, ETA edits, and payment confirmation are fetched through `/api/dashboard/[businessId]/orders`, `/api/dashboard/[businessId]/orders/[orderId]/status`, `/api/dashboard/[businessId]/orders/[orderId]/eta`, and `/api/dashboard/[businessId]/orders/[orderId]/payment`.
- Orders list defaults to all dates so the table does not hide existing historical orders; users can still filter to Today, Last 7 days, or Custom.
- Orders table columns are Order #, Customer with phone below, Order type, Items, Total from `FINAL_AMOUNT`, Payment status badge, Status badge, ETA, Ordered at, and Actions. Do not show `PAYMENT_MODE` in the table.
- Orders table and details must show the official display order number (`ORDER_NUMBER`, falling back to `FDZ.` plus `BUSINESS_ORDER_ID` padded to 6 digits), not raw `#BUSINESS_ORDER_ID`.
- Orders table payment status shows `Refund pending` when `STRIPE_REFUND_STATUS` exists but `PAYMENT_DONE` is not yet refunded. Payment mode and Stripe payment intent stay in the details modal only.
- Orders table ETA shows time only (`HH:mm`, for example `20:20`). If `DELIVERY_ET` is null, calculate the display from `CREATION_DATETIME` plus the delivery or pickup prep default through `getDisplayEta` and show a subtle `Default` badge; keep the date internal.
- Order detail modal displays order ID, order type, status badge/action buttons, placed time, estimated delivery/pickup time with editable `datetime-local` input, payment mode/status, optional staff/terminal, rejection reason/note when rejected, full customer contact/address fields, payment details (`GROSS_AMOUNT`, `DISCOUNT_AMOUNT`, `SHIPPING_AMOUNT`, `TAX_AMOUNT`, `REFUND_AMOUNT`, `FINAL_AMOUNT`), and item rows with product name, quantity, unit price, discount, and computed subtotal.
- Pickup orders should use the same order detail surface but label `DELIVERY_ET` as estimated pickup time. Delivery orders should continue to label it as estimated delivery time.
- New preparing orders with `ETA_ACKNOWLEDGED_DATETIME = null` must not trigger a blocking ETA popup. Keep notification/polling behavior, but ETA is edited from the order details modal when needed.
- Orders management polls the orders API every 30 seconds without resetting selected filters.
- Order status badges should use the shared helper colors: preparing blue, out-for-delivery/ready-for-pickup purple, delivered/picked-up green, rejected red.
- Dashboard recent-order badges should use the same status mapping as the Orders page through `src/lib/orderStatus.ts`.

## Practical Guidance For Future Agents

- Read the relevant page, component, route handler, and helper before editing; patterns are split across app routes, products components, services, and lib helpers.
- Keep business-scoped API changes consistent with the existing owner-access authorization flow.
- Do not introduce a second Prisma client import path.
- Do not duplicate database schema details here; check `prisma/schema.prisma`.
- For manual SQL changes, add a timestamped folder under `prisma/migrations` with a `migration.sql` file matching the existing migration layout. Do not run `prisma migrate`, `db pull`, or `generate` unless the user explicitly asks for that step.
- Preserve existing Foodeez styling tokens and component library usage.
- For selected-business admin chrome changes, prefer extending `src/components/admin` and keep `src/app/dashboard/[businessId]/layout.tsx` as a thin wrapper around `AdminShell`.
- For root dashboard, selected-business dashboard, and selected-business Menu/product catalog changes, prefer extending `src/services/admin-data.ts` and the relevant server page before adding client-side fetching.
- For selected-business Menu Card/Product/Category/Tag API behavior, prefer extending `src/services/menu-management.ts` so ownership, soft delete behavior, tag/category relationship shaping, counts, ordering, and preview behavior stay consistent.
- For Menu Card detail changes, preserve the explicit Save Changes workflow. Do not make Add, Remove, or drag reorder immediately persist unless the UX is intentionally changed everywhere.
- For Menu Card customer visibility, keep admin status and view SQL in sync. Disabled menu cards should not appear through `business_food_menu_card_view`, `business_food_menu_card_detail_view`, or `business_having_active_menu_card_view`.
- For selected-business Settings behavior, prefer extending `src/services/settings-management.ts` and `AdminSettingsForm`.
- For Orders management changes, prefer extending `src/services/orders-management.ts` so the page UI and API routes share the same status mapping, filtering, authorization, and transition rules.
- For order lifecycle work, keep status constants, labels, badge colors, and transition rules in `src/lib/orderStatus.ts`; do not duplicate raw status-number maps in components.
- For fulfillment settings, preserve legacy ZIP-code behavior while adding delivery zones and pickup options. Treat `DELIVERY_ZONES_JSON` as app-owned JSON text, not as a normalized relational model unless a future migration explicitly changes that.
- Keep fulfillment settings UI lean: avoid rendering the same editable setting in multiple sections, and keep legacy delivery-area controls secondary to the new delivery-zone workflow unless backward-compatibility work explicitly needs them front and center.
- For checkout fulfillment support, keep the calculation rules in `src/lib/fulfillment.ts` and have routes call the helper instead of duplicating postal-code matching or pricing rules.
- For notification work, keep notification reads, unread counts, expiry filtering, and links business-scoped through `business_notification.BUSINESS_ID`.
- When adding product category behavior, remember that categories are not directly linked from `business_product`; check `prisma/schema.prisma` and the current tag-inference approach before changing assumptions.
- For media changes, use the existing upload utilities and S3 storage helpers.
- For new dashboard sections, follow the selected-business route structure under `src/app/dashboard/[businessId]`.
