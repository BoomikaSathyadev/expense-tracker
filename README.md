# Expense Tracker

A personal expense tracker built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor → New Query**
3. Paste and run the contents of `supabase-schema.sql`
4. Go to **Authentication → Providers** and ensure Email is enabled
5. Copy your **Project URL** and **anon public key** from **Settings → API**
6. Go to **Authentication → URL Configuration** and add the reset page URLs
   under **Redirect URLs**:
   - `http://localhost:3000/auth/confirm` for local development
   - `https://your-production-domain/auth/confirm` for production
   - Add the matching confirmation path for any preview deployment domains

Keep **Site URL** set to your production app URL. The callback supports
Supabase's default confirmation link. For recovery links that can also be
opened in a different browser or on a mobile device, update
**Authentication → Email Templates → Reset Password** to use a token-hash link:

```html
<p>Use the link below to choose a new password:</p>
<p>
  <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">
    Reset password
  </a>
</p>
```

The app supplies `/auth/confirm?next=%2Freset-password` as the redirect target.
The confirmation page verifies the recovery token (or exchanges a default
same-browser PKCE code) with Supabase, then sends the user to `/reset-password`.

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

### 4. Add lending and borrowing records

Run `supabase/migrations/202611240001_lending_borrowing.sql` in the Supabase SQL
Editor before deploying this feature. It creates separate transaction and
repayment tables, enables user-scoped Row Level Security, and prevents
repayments from exceeding a transaction balance. Deleting a transaction
cascades to its repayment history; the app asks for confirmation before doing
so. Transaction amounts cannot be edited below the repayments already recorded.

### 5. Install & Run

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
- Dashboard: income, expenses, savings, cumulative savings, category breakdown,
  and separate outstanding lent/borrowed totals
- Lend & Borrow: person-grouped transactions, partial/full repayments, and
  editable repayment history
- History: filter by month, edit and delete expenses
- Settings: account info, logout, clear all data
- PWA installable
- Mobile-first design
- Row Level Security — each user sees only their own data
