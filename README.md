# Expense Tracker

A personal expense tracker built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**
3. Paste and run the contents of `supabase-schema.sql`
4. Go to **Authentication → Providers** and ensure Email is enabled
5. Copy your **Project URL** and **anon public key** from **Settings → API**

### 2. Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Upgrade an existing project to multiple income records

Before deploying a version that uses multiple income records, run
`supabase/migrations/202610310001_income_records.sql` in the Supabase SQL Editor.
The migration creates the dated `income_records` table, enables user-scoped RLS,
and copies each prior monthly income amount to a record dated on the first of
that month. It keeps `monthly_income` and its original rows intact. The migration
is safe to rerun for the legacy copy because each migrated row is linked to its
original `monthly_income` row.

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Vercel Deployment

1. Push to GitHub
2. Import the repo in Vercel
3. Add the two environment variables in Vercel project settings
4. Deploy

## Features

- Sign up / Login / Logout (Supabase Auth)
- Monthly income — set and edit per month
- Add expenses with category, optional note, and date
- "Other" category with custom label
- Dashboard: income, expenses, savings, cumulative savings, category breakdown
- History: filter by month, edit and delete expenses
- Settings: account info, logout, clear all data
- PWA installable
- Mobile-first design
- Row Level Security — each user sees only their own data
