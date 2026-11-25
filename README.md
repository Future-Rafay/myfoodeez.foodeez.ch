# Foodeez Admin (myfoodeez.foodeez.ch)

Restaurant owner dashboard and Super Admin panel for Foodeez: menus, products and stock, online orders and Stripe refunds, discounts, and the web POS. It shares one MySQL/MariaDB database with the customer site (`foodeez.ch`) and serves the API used by the `foodeez-pos` Android app.

Current release: **v1.0.0** (2026-11-26), the first stable release. For the next few months only minor fixes and tests are planned. Release and deployment notes are in [agents.md](agents.md).

Stack: Next.js 16 App Router, TypeScript, Prisma (MariaDB adapter), NextAuth credentials, Tailwind CSS, deployed on Vercel.

## Setup

```bash
npm.cmd install
npx.cmd prisma generate
npm.cmd run dev
```

Copy `.env.example` to `.env` and fill in the values (database, NextAuth, Stripe, Resend, S3). `.env.example` is gitignored, so ask for it.

Schema changes are hand-written SQL under `prisma/migrations` and `docs/sql`. Apply them manually, then run `npx prisma db pull` and `npx prisma generate`. Do not run `prisma migrate` against the shared database.

## Checks

```bash
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

`npm test` generates the Prisma client first and needs no database.

## Working on this repo

Project rules, routes, data conventions and business logic are in [agents.md](agents.md). Read it before changing anything.
