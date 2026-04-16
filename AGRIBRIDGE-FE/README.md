# AGRIBRIDGE-FE

Homepage wireframe for AgriBridge B2B marketplace.

## Stack

- React + TypeScript + Vite
- React Router
- Tailwind CSS
- Axios
- Framer Motion
- Lucide React

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy environment config:

```bash
cp .env.example .env
```

3. Start dev server:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

## Build

```bash
npm run build
```

## API integration

Base URL is loaded from `VITE_API_BASE_URL`, defaulting to `http://localhost:8081`.

Endpoints used by homepage:

- `GET /api/home/stats`
- `GET /api/home/features`
- `GET /api/home/steps`
- `GET /api/home/testimonials`
- `GET /api/home/market-prices`
- `GET /api/home/cta-summary`

If backend is unavailable, frontend automatically falls back to domain mock data in `src/data`.

## Image replacement

Temporary local assets are in `public/images`.
Replace them with real industry photos (farm, seafood market, warehouse, shrimp, fish, rice, dragon fruit) before production.
Details are documented in `public/images/README.txt`.
