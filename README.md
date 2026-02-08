## TrueCost

Fintech app that makes spending feel real by translating purchases into **Work Time**, visualizing paycheck burn, and showing “what if you invested instead?” projections.

### Features

- **Dashboard:** animated paycheck pulse + spending breakdown + recent expenses.
- **Insights:** predictive signals + subscription “Danger Center” + net worth projections.
- **Item search:** Amazon-style item page with split comparison (buy vs invest) and **Ghost Cart** (“Ghost It” instead of buying).
- **User settings:** hourly wage, pay period, currency (CAD/USD), expected return, misery index (stress multiplier), and a theme toggle.

### Tech

- Next.js App Router (React)
- Drizzle ORM + SQLite (`better-sqlite3`)
- Tailwind v4 + Recharts

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database / migrations

- SQLite file: `db.sqlite` (ignored by git)
- Generate migration:

```bash
npm run db:generate
```

- Apply migrations:

```bash
npm run db:migrate
```

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
```

## Notes

- The app defaults to a demo user until you create an account on `/user`.
- Product images are local in `public/products/` with a fallback `public/placeholder.svg`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
