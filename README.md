# Loafers Bakery OS

Loafers Bakery OS is a mobile-first operating system for a one-person home bakery. It helps a solo baker take customer orders, plan bakes, manage starters, run a live kitchen board, publish a customer storefront, track inventory and costs, send order updates, and keep safety records for bread and non-bread products.

The full owner guide, feature list, usage instructions, and changelog are in:

[docs/loafers-bakery-os-guide.md](docs/loafers-bakery-os-guide.md)

## Live app

Owner app:

`https://loafer-hub.github.io/loafers-bakery-os/`

Customer storefront:

`https://loafer-hub.github.io/loafers-bakery-os/?order=loafers`

When the Starlight VM deployment is enabled, the same frontend can also be hosted on the bakery domain while keeping Supabase and Resend in place.

## What it does

- Owner command center for pending requests, today’s work, accepted orders, ready shelf, active bakes, pickup windows, and shortages
- Customer order flow with menu browsing, cart review, pickup choice, contact/payment, order request, accounts, profiles, reorder support, and Track My Bake
- Product catalog for sourdough, yeast breads, bagels, buns, cakes, pastries, hot sauces, vinegars, infused oils, and other goods
- Recipe builder with grams or baker’s percentages, package pricing, product photos, availability, badges, flour science, nutrition estimates, and product-type settings
- Bake planning with dynamic sourdough and yeast timelines, starter feeds, rise/proof logic, stretch-and-fold controls, kitchen checklists, batch grouping, and calendar views
- Liquid lab for hot sauce, vinegar, and infused oil planning, including salt, pH, temperature, acidity, storage, warning, shelf-life, and recall records
- Inventory, purchases, barcode/CSV import, cost tracking, expenditure trends, customer records, and business reporting
- Cloud order storage through Supabase, automatic emails through Resend, and installable PWA support for phone-style use without a Mac

## Current owner structure

The owner app is organized around the real flow of a solo bakery:

| Area | Clean role |
| --- | --- |
| Today | Daily command center |
| Orders | Requests, active orders, customer records, and order calendar |
| Production | Bread work and Liquid lab |
| Production > Bread work > Bake desk | Plan, Kitchen, Batches, Calendar, and Starters |
| Menu | Product catalog, recipes, ready shelf, and customer storefront preview |
| Business | Inventory, purchases, customers, order history, trends, and reporting |
| Settings | Bakery rules, privacy, product types, pickup rules, options, and notifications |
| Storage | Backup, restore, recovery, and storage status |

Older rough names were cleaned up as follows: Trends is now Business, Recipes/products live under Menu, and the old Bake area now lives under Production > Bread work as the Bake desk.

## Run locally

```powershell
npm install
npm run dev
```

Then open the local address shown in the terminal.

## Build

```powershell
npm run build
```

The compiled app is written to `dist`.

## Cloud setup

Supabase setup notes live in [supabase/README.md](supabase/README.md). The browser app uses only the public Supabase URL and anon key. Never put a Supabase service-role key in the frontend, GitHub Pages, or public repo files.

Resend is used by the Supabase Edge Function for automatic customer email updates.

## Starlight VM deploy

The Starlight workflow builds the app, backs up the existing website folder, preserves `.well-known`, and swaps in the latest `dist` files.

Setup details live in [docs/starlight-vm-deploy.md](docs/starlight-vm-deploy.md).

## iOS / app-like use

The near-term “iPhone app” path is the installable mobile web app:

- Add to Home Screen support
- App icon and splash behavior
- Offline shell fallback
- Mobile-first layout

An iOS Capacitor shell also exists in `ios/App`, but building and signing a native iOS app requires macOS, Xcode, and an Apple Developer account.

```powershell
npm run ios:sync
npm run ios:open
```
