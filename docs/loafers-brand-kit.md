# Loafers Home Bakery brand kit

Last updated: July 1, 2026

## Brand name

Public business name: **Loafers Home Bakery**

Short name: **Loafers**

Owner app working name: **Loafers Command**

Primary tagline: **Handcrafted bread. Made at home.**

Extended line: **Real ingredients. Honest baking. From our home to yours.**

## Source artwork

The app brand is based on the owner-provided badge and advertising banner:

- `public/brand/loafers-home-bakery-badge.png`
- `public/brand/loafers-home-bakery-banner.png`
- `public/brand/loafers-home-bakery-banner-hero.jpg` — optimized app hero version

The visual identity should match the supplied artwork:

- Alaska night sky
- Aurora green and violet
- Mountain silhouettes
- Spruce trees
- Wheat and rustic bread
- Flour-gold vintage lettering
- Toasted crust browns
- Premium home-bakery warmth

## Color tokens

| Token | Use | Hex |
| --- | --- | --- |
| Night Rye | Deep app frame, dark surfaces | `#06101d` |
| Deep Night | Strongest dark / logo backing | `#020509` |
| Aurora Green | Glow, focus rings, positive highlight | `#58c46e` |
| Aurora Violet | Atmospheric glow | `#8d3fc6` |
| Flour Gold | Logo ring, premium accents | `#ecd0a4` |
| Toasted Crust | Primary buttons/accent | `#b86b2d` |
| Ember | Warm highlight | `#d28a3f` |
| Spruce | Food/safety/positive secondary | `#2f6c4e` |
| Oat Cream | Main readable app surface | `#fff7e9` |
| Dark Rye Ink | Main text | `#1b120c` |

## Typography

Current app fonts:

- Display: `Newsreader`, used for headings and brand moments.
- UI/body: `DM Sans`, used for controls, forms, tables, and dense owner workflows.

Future UI refresh direction:

- Keep a strong vintage serif feel for large customer-facing moments.
- Keep owner tools highly readable with the clean sans-serif.
- Avoid tiny decorative type in functional controls.

## Logo usage

Use the round badge for:

- PWA/app icon
- Owner app header badge
- Customer storefront header badge
- Offline screen
- Brand lockups

Use the banner for:

- Customer storefront hero
- Marketing/social preview areas
- Future customer landing view

Avoid using the full banner as a tiny logo; it becomes unreadable below card/hero size.

## UI direction

Owner UI:

- Command-center feel
- Dark aurora outer shell
- Light oat working surfaces for readability
- Toasted crust buttons
- Spruce/aurora status accents
- Less generic card clutter over time

Customer UI:

- More visual and premium
- Banner-led first impression
- Warm dark/gold feel
- Product cards should feel like a bakery shelf
- Checkout should stay simple and trustworthy

## Implementation notes

The first brand-kit layer is implemented in:

- `src/lib/brand.js`
- `src/styles.css`
- `src/components/AppChrome.jsx`
- `src/pages/CustomerOrderPortal.jsx`
- `public/manifest.webmanifest`
- `public/offline.html`
- `public/sw.js`

The full screen-by-screen UI overhaul should build on these tokens instead of inventing a second style.
