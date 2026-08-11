# WealthLedger

Personal finance dashboard for Indian users — net worth, cash flow, investments, credit cards, budgets, goals, and a full loan prepayment simulator. **INR only**, with Indian number formatting (₹1,25,000).

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui + Framer Motion + next-themes
- **Supabase** — Auth, PostgreSQL, RLS, Storage
- **TanStack Query** · React Hook Form · Zod · Recharts
- Deploy: **Vercel** (no Docker / Redis / microservices)

## Modules

| # | Module | Status |
|---|--------|--------|
| 1 | Dashboard | ✅ |
| 2 | Bank Accounts | ✅ |
| 3 | Transactions | ✅ |
| 4 | Income | ✅ |
| 5 | Expenses | ✅ |
| 6 | Credit Cards | ✅ |
| 7 | Investments | ✅ |
| 8 | Loans (EMI modes, amortization, prepayment simulator) | ✅ |
| 9 | Budgets | ✅ |
| 10 | Net Worth | ✅ |
| 11 | Goals | ✅ |
| 12 | Financial Calendar | ✅ |
| 13 | Reports | ✅ |
| 14 | Settings (theme, profile, JSON backup/restore) | ✅ |

Also included: **global search** (⌘K), **notifications panel**, dark/light mode.

## Quick start

### 1. Install

```bash
npm install
```

### 2. Supabase

Follow the full guide: **[SETUP_SUPABASE.md](./SETUP_SUPABASE.md)**

Summary:

1. Create a Supabase project
2. Copy **Project URL** + **anon key** into `.env.local`
3. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
4. Configure Email (+ optional Google) auth and redirect URLs

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Optional demo data

After signup, copy your user UUID from **Authentication → Users**, then in SQL Editor:

```sql
-- first run supabase/seed/seed.sql if not already applied
SELECT seed_demo_data('YOUR-USER-UUID');
```

## Deploy on Vercel

1. Push to GitHub → Import in Vercel
2. Set env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`
3. Update Supabase Site URL + redirect URLs to the production domain

See [SETUP_SUPABASE.md](./SETUP_SUPABASE.md) §9.

## Folder structure

```
app/                 # App Router (auth + dashboard routes)
components/          # Layout, shared UI, shadcn primitives
features/            # Feature modules (dashboard, accounts, loans, …)
hooks/               # Shared hooks
lib/                 # Supabase, auth, validations, loan math, constants
utils/               # INR currency + date helpers
types/               # Shared TypeScript types
supabase/            # Migrations + seed
SETUP_SUPABASE.md    # Credentials & project setup instructions
```

## Auth

- Email + password
- Magic link
- Google OAuth
- Forgot / reset password

All tables use **Row Level Security** (`auth.uid() = user_id`).

## Scripts

```bash
npm run dev          # development
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
npm run typecheck    # TypeScript
```

## License

Private — all rights reserved.
