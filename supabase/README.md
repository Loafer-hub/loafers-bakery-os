# Loafers cloud setup

1. Create a Supabase project.
2. Open the SQL editor and run `migrations/202606190001_cloud_accounts_orders.sql`.
3. Add the project URL and publishable/anon key to a local `.env` file using `.env.example`.
4. In GitHub repository settings, add matching Actions secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Re-run the GitHub Pages workflow.

The browser app uses only the public key. Row-level security protects bakery snapshots, customer records, products, and order requests. Never put a Supabase service-role key in this app or in GitHub Pages.
