# Supabase Setup Guide — WealthLedger

This guide walks you through creating a Supabase project, finding your credentials (including the new **Publishable** key that replaced the old **anon** key), running the database migration, and connecting WealthLedger.

> **Why you might not see an “anon” key**  
> Supabase redesigned API keys. New projects often show a **Publishable key** (`sb_publishable_...`) instead of (or in addition to) the legacy **anon** JWT.  
> **For WealthLedger, use either:**
>
> - **Publishable key** (recommended) → paste into `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> - **Legacy anon key** (if still available) → same env variable  
>
> They work the same for this app. Do **not** use Secret / `service_role` keys in `.env.local`.

---

## 1. Create a Supabase account & project

1. Open [https://supabase.com](https://supabase.com) and click **Start your project** (or **Sign in**).
2. Sign in with GitHub / Google / email.
3. Click **New project**.
4. Fill in:
   - **Organization** — pick or create one
   - **Project name** — e.g. `wealthledger`
   - **Database password** — generate a strong password and **save it somewhere safe** (you need it for direct DB access; the app itself uses API keys, not this password)
   - **Region** — choose the closest, e.g. **Mumbai (ap-south-1)** for India
5. Click **Create new project**.
6. Wait 1–2 minutes until the dashboard shows the project is ready (status **Healthy** / green).

---

## 2. Get your Project URL and API key (detailed)

You need **two** values:

| What you need | Env variable in WealthLedger | Looks like |
|---------------|------------------------------|------------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefghijklmnop.supabase.co` |
| Publishable **or** anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` **or** a long `eyJ...` JWT |

### Method A — Easiest: Connect dialog (recommended)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. At the top of the project page, click the **Connect** button.
3. Open the **API Keys** / **App Frameworks** / connection tab that shows credentials (wording may say **API Keys**).
4. You should see:
   - **Project URL** / **API URL** → copy this
   - **Publishable key** → copy this (use for WealthLedger)
   - Possibly also **Anon key** (legacy) → either works

Paste them into `.env.local` as described in [§3](#3-create-envlocal).

Direct link pattern (replace `YOUR_PROJECT_REF` with the id in your project URL):

```
https://supabase.com/dashboard/project/YOUR_PROJECT_REF?showConnect=true
```

---

### Method B — Project Settings → API Keys (most reliable)

This is where keys live in the **current** dashboard. The old path “Settings → API → Project API keys → anon public” is outdated.

1. In the left sidebar, click the **gear icon** → **Project Settings**.
2. Under **CONFIGURATION** (or similar), click **API Keys**  
   Direct URL pattern:
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api-keys
   ```
3. You will see tabs. Use one of the paths below.

#### Option B1 — New keys (Publishable) — use this if you see it

1. Stay on the tab named something like **Publishable and secret API keys** or **API Keys**.
2. If the page says **Create new API Keys** / **Create API key**, click it once.  
   This is safe: it adds new keys **alongside** any legacy keys; it does not break existing apps.
3. Under **Publishable key**, click **Copy**.  
   - Value starts with `sb_publishable_`
   - This replaces the old **anon** key for client apps
4. Ignore **Secret keys** (`sb_secret_...`) for WealthLedger — those are server-only and bypass RLS (like the old `service_role`).

#### Option B2 — Legacy anon key — if Publishable is missing or you prefer JWT

1. Click the tab named **Legacy API Keys** (or **Legacy**).
2. Find the key labeled **`anon`** / **`anon` `public`**.
3. Click **Reveal** / eye icon if the value is hidden, then **Copy**.  
   - Value is a long JWT starting with `eyJ`
4. Do **not** copy **`service_role`**.

#### Option B3 — Project URL (always needed)

1. Still in **Project Settings**, open **Data API** or **API** (sometimes still listed separately from **API Keys**):
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_REF/settings/api
   ```
2. Copy **Project URL** (also called **API URL**).  
   Example: `https://xyzcompanyabc.supabase.co`

You can also derive it: in the browser address bar your project ref is the segment after `/project/`.  
URL = `https://<that-ref>.supabase.co`.

---

### Visual map: where keys moved

| Old dashboard (docs / tutorials) | New dashboard (what you see now) |
|----------------------------------|----------------------------------|
| Settings → **API** → Project API keys → `anon` `public` | Settings → **API Keys** → **Legacy API Keys** → `anon` |
| (did not exist) | Settings → **API Keys** → **Publishable key** (`sb_publishable_...`) |
| Settings → API → `service_role` | Settings → API Keys → Secret / Legacy `service_role` — **do not use in this app** |

---

### What to put in WealthLedger

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx   # OR the eyJ... anon JWT
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The env variable is still named `NEXT_PUBLIC_SUPABASE_ANON_KEY` for compatibility with `@supabase/ssr`.  
**A Publishable key is the correct modern value for that variable.**

---

## 3. Create `.env.local`

In the WealthLedger project root (`D:\Projects\Finance_Tracker`):

**PowerShell:**

```powershell
Copy-Item .env.local.example .env.local
```

**macOS / Linux:**

```bash
cp .env.local.example .env.local
```

Open `.env.local` in your editor and replace the placeholders:

```env
# From Settings → API (Project URL)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co

# MUST be named NEXT_PUBLIC_SUPABASE_ANON_KEY (do not rename the variable)
# Paste your Publishable key (sb_publishable_...) OR Legacy anon JWT (eyJ...)
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-your-key-here

# Local app URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Common mistake

| Wrong (will crash middleware) | Correct |
|-------------------------------|---------|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...` | `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` |

The **value** can be a Publishable key. The **variable name** must stay `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Rules:

- No quotes around values
- No spaces before/after `=`
- Do not commit `.env.local` to git

Restart the dev server after any change (stop with Ctrl+C, then):

```bash
npm run dev
```

---

## 4. Run the database migration

This creates all tables, RLS policies, storage buckets, and the signup trigger.

1. In the Supabase sidebar, open **SQL Editor**.
2. Click **New query**.
3. On your computer, open and run **in order**:

   1. `supabase/migrations/001_initial_schema.sql`
   2. `supabase/migrations/002_quarterly_investment_reminder.sql`
   3. `supabase/migrations/003_investment_sip.sql`
   4. `supabase/migrations/004_delete_own_account.sql` (account self-deletion)
   5. `supabase/migrations/005_credit_card_billing_days.sql` (billing/due days 1–31)
   6. `supabase/migrations/006_extra_categories.sql` (Subscriptions, Gym, Trading/Stock returns)

4. Click **Run** for each (or paste both if preferred, one after the other).
5. Confirm you see **Success** (no red errors).

Migration **002** adds the quarterly investment-value reminder notification type and settings toggle.  
Migration **003** adds SIP fields on investments (monthly MF SIPs).

What this creates:

- Tables: profiles, accounts, transactions, categories, credit cards, loans, investments, budgets, goals, notifications, settings, reports, etc.
- **Row Level Security** so each user only sees their own rows
- Storage buckets: `receipts`, `loan-documents`, `investment-documents`, `avatars`
- Trigger on signup that creates a profile, settings, and default income/expense categories

### If a trigger error appears

Some Postgres versions want `EXECUTE PROCEDURE` instead of `EXECUTE FUNCTION` in trigger definitions. If you get that error, in the migration file replace:

```sql
EXECUTE FUNCTION set_updated_at();
```

with:

```sql
EXECUTE PROCEDURE set_updated_at();
```

(and the same for other `EXECUTE FUNCTION` trigger lines), then re-run only the failed parts — or drop created objects and run the full script again if needed.

---

## 5. Configure Authentication

### 5.1 Email (password + magic link)

1. Sidebar → **Authentication** → **Providers**.
2. Open **Email**.
3. Ensure **Enable Email provider** is ON.
4. For local testing you may turn **Confirm email** OFF so you can sign in immediately without clicking a mail link.  
   Turn it back ON for production.

### 5.2 URL configuration (required for login redirects)

1. **Authentication** → **URL Configuration**.
2. Set **Site URL** to:
   ```
   http://localhost:3000
   ```
3. Under **Redirect URLs**, add (one per line / add button):
   ```
   http://localhost:3000/callback
   http://localhost:3000/reset-password
   ```
4. Save.

When you deploy to Vercel, add your production URLs too, e.g.:

```
https://your-app.vercel.app
https://your-app.vercel.app/callback
https://your-app.vercel.app/reset-password
```

And set **Site URL** to the production domain for the live environment (or update it when you go live).

### 5.3 Google login (optional)

1. **Authentication** → **Providers** → **Google** → Enable.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create **OAuth client ID** → type **Web application**
   - **Authorized JavaScript origins:** `http://localhost:3000` (+ production URL later)
   - **Authorized redirect URIs:**  
     `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`  
     (must be the **Supabase** callback, not localhost)
3. Copy **Client ID** and **Client Secret** into the Supabase Google provider form → Save.

---

## 6. Verify Storage buckets

1. Sidebar → **Storage**.
2. After the migration you should see:

| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | Yes | Profile pictures |
| `receipts` | No | Expense receipts |
| `loan-documents` | No | Loan documents |
| `investment-documents` | No | Investment documents |

If buckets are missing, re-run the storage section at the bottom of `001_initial_schema.sql`, or create them manually with the same names.

---

## 7. Run WealthLedger locally

```bash
npm install
npm run dev
```

1. Open [http://localhost:3000](http://localhost:3000).
2. Click **Create account**, register with email/password.
3. You should land on the Dashboard.
4. Confirm in Supabase **Authentication → Users** that your user exists.
5. Confirm in **Table Editor → profiles** that a profile row was created.

---

## 8. (Optional) Load demo / seed data

1. **Authentication → Users** → copy your user’s **UUID**.
2. **SQL Editor** → paste and run the full file `supabase/seed/seed.sql` (defines the function).
3. Then run:

```sql
SELECT seed_demo_data('PASTE-YOUR-USER-UUID-HERE');
```

4. Refresh the app — you should see sample accounts, transactions, loans, etc.

---

## 9. Deploy to Vercel

1. Push the repo to GitHub (do **not** commit `.env.local`).
2. [Vercel](https://vercel.com) → **Add New Project** → import the repo.
3. **Settings → Environment Variables** — add for Production (and Preview):

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | same as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same Publishable or anon key |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

4. Deploy.
5. Update Supabase **Site URL** + **Redirect URLs** to the production domain ([§5.2](#52-url-configuration-required-for-login-redirects)).
6. Update Google OAuth origins if you use Google.

---

## 10. Quick checklist

- [ ] Project created and Healthy
- [ ] Project URL copied → `NEXT_PUBLIC_SUPABASE_URL`
- [ ] **Publishable** key **or** Legacy **anon** key copied → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `.env.local` saved; no `service_role` / secret key used
- [ ] `001_initial_schema.sql` ran successfully
- [ ] Email auth enabled; Site URL + redirect URLs set
- [ ] `npm run dev` → signup works → profile row exists
- [ ] (Optional) Seed data loaded
- [ ] (Optional) Vercel env vars + production redirect URLs

---

## Troubleshooting: “I don’t see an anon key”

| What you see | What to do |
|--------------|------------|
| Only **Publishable key** (`sb_publishable_...`) | Use it in `NEXT_PUBLIC_SUPABASE_ANON_KEY`. That **is** the replacement for anon. |
| Button **Create new API Keys** | Click it, then copy the **Publishable** key. |
| Tab **Legacy API Keys** | Open it → reveal/copy **`anon`**. |
| Settings → **API** page has URL but no keys | Keys moved to Settings → **API Keys** (`.../settings/api-keys`). |
| Empty / permission error on API Keys | You must be **Owner** or **Admin** of the project; ask the org owner for access. |
| Copied `service_role` or `sb_secret_...` | Wrong key. Replace with Publishable or anon. Secrets bypass RLS and must never be in `NEXT_PUBLIC_*`. |
| Key looks right but app says Invalid API key | Restart `npm run dev`; check for quotes/spaces/line breaks in `.env.local`; confirm URL and key are from the **same** project. |

---

## Other troubleshooting

| Issue | Fix |
|-------|-----|
| Always redirected to `/login` | Env vars missing or wrong; restart dev server after editing `.env.local` |
| Signup works but no categories / profile | Migration trigger missing — re-run `001_initial_schema.sql`; check `handle_new_user` exists |
| Google login fails | Redirect URI must be `https://<project-ref>.supabase.co/auth/v1/callback` |
| RLS / permission denied on tables | User must be logged in; policies use `auth.uid() = user_id` |
| Storage upload fails | Buckets exist; upload path must start with `{user_id}/` |

---

## Credential security

- Never commit `.env.local`.
- Never put **Secret** / **`service_role`** keys in `NEXT_PUBLIC_*` variables.
- If a key leaks: rotate/disable it under **Settings → API Keys**, then update `.env.local` and Vercel.
- Database password (from project creation) is separate from API keys — store it securely; WealthLedger does not need it for normal use.

---

## Official Supabase docs

- [API keys overview](https://supabase.com/docs/guides/getting-started/api-keys)
- [Migrating to new API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- Dashboard API Keys: `https://supabase.com/dashboard/project/_/settings/api-keys`
