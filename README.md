# Portfolio Management Dashboard

A Next.js portfolio dashboard for tracking holdings, trades, dividends, live market prices, and portfolio performance.

## Features

- JWT login with a seeded demo user
- Holdings table with live current prices, allocation, invested value, unrealized gain, daily gain, dividends, and total gain
- Buy and sell transaction entry with automatic holding updates
- Manual dividend entry plus automatic Yahoo Finance dividend history
- Portfolio distribution donut chart by asset or asset type, with hover details
- Performance charts for return rate, asset value, and daily earnings
- Recent transaction history with trade and dividend views

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- LowDB JSON file storage
- Yahoo Finance chart endpoints for market data

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Demo login:

- Email: `user@example.com`
- Password: `password`

## Test And Build

```bash
npm test
npm run build
```

## Docker

Build and run the production container:

```bash
docker build -t portfolio-dashboard .
docker run --rm -p 3000:3000 -e JWT_SECRET=your-secret portfolio-dashboard
```

Or use Docker Compose:

```bash
docker compose up --build
```

Open `http://localhost:3000`.

## Data

The demo database is stored in `data/db.json`. It contains the seeded user, holdings, transactions, and sample history data.
