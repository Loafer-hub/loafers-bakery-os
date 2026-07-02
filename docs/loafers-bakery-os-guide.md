# Loafers Bakery OS feature guide

Last updated: July 2, 2026

Loafers Bakery OS is a bakery command center built around one real constraint: a home baker does not have a staff. The app is designed to act like the missing office manager, prep list, order book, production planner, storefront, label helper, and memory system.

It is not only a bread calculator. It is a working bakery workflow:

1. Customers browse the menu and send order requests.
2. The baker accepts, rejects, comments, schedules, and tracks those requests.
3. The app turns accepted orders into starter feeds, bake work, pickup windows, labels, inventory needs, and customer updates.
4. The baker can also sell ready-now shelf items and non-bread products like hot sauces, vinegars, infused oils, cakes, buns, bagels, and yeast breads.

## Live locations

Owner app:

`https://loafer-hub.github.io/loafers-bakery-os/`

Customer storefront:

`https://loafer-hub.github.io/loafers-bakery-os/?order=loafers`

Starlight VM/domain hosting can also serve the same built app when the VM deployment is enabled.

Brand kit:

`docs/loafers-brand-kit.md`

## Clean structure and naming

The app now has two clear sides:

- Owner App: the private bakery operating system used by the baker.
- Customer Storefront: the public order page customers use to browse, request, and track orders.

Going forward, use these names consistently:

| Current name | What it means | Older/rough names it replaces |
| --- | --- | --- |
| Today | Daily command center for what needs attention now | Home, dashboard |
| Orders | Owner order desk for requests, active orders, customers, and order calendar | Requests, order manager |
| Production | The full making-work area | Bake tab, Bake / Production |
| Production > Bread work | Bread, yeast, starter, and bake workflow | Bake |
| Bread work > Bake desk | The branded command view inside Bread work | Dynamic bake plan area |
| Bake desk > Plan | Build one science-backed bake timeline | Schedule |
| Bake desk > Kitchen | Active in-progress bakes and checklists | Kitchen board |
| Bake desk > Batches | Group accepted orders into efficient production | Batch plan |
| Bake desk > Calendar | Planned bakes, accepted order bakes, blocked days | Bake calendar |
| Bake desk > Starters | Starter profiles, feed logs, and starter science | Starter care |
| Production > Liquid lab | Hot sauces, vinegars, infused oils, pH/salt/safety records | Liquid |
| Menu | Product catalog, recipes, ready shelf, storefront preview | Recipes, products |
| Business | Inventory, purchases, customers, order history, reporting | Trends |
| Settings | Bakery controls, privacy, product types, pickup rules, notifications | Storefront settings, controls |
| Storage | Backup, restore, recovery, local/cloud storage status | Backup center |

The main owner workflow should be read like this:

1. Today tells the baker what needs attention.
2. Orders handles customer requests and commitments.
3. Production turns commitments into real work.
4. Menu controls what customers can buy.
5. Business tracks supplies, money, customers, and history.
6. Settings controls rules and visibility.
7. Storage protects the data.

## High-level app map

The owner side is organized around the way a solo bakery actually works:

| Area | Purpose |
| --- | --- |
| Today | Daily command center: requests, active work, production dashboard, visual fermentation, ready shelf, starter quick log |
| Orders | Customer requests, accepted orders, order details, payment state, customer profiles, order calendar |
| Production | Bread work, Bake desk, live kitchen tracking, Batches, Calendar, Starters, Liquid lab |
| Menu | Product catalog, recipes, storefront settings shortcut, ready shelf, owner preview of the customer page |
| Business | Inventory, purchases, barcode import, spending trends, customers, order history, owner cockpit |
| Settings | Storefront, customer privacy, product types, product availability, capacity, pickup hours, notifications |
| Storage | Backup, restore, recovery copy, local/cloud storage status |

The customer side is a simpler flow:

1. Browse menu
2. Review cart
3. Choose pickup
4. Enter contact and payment choice
5. Send request
6. Optionally sign in, save preferences, reorder, or track bake status

## Core owner features

### Today command center

The Today page is the baker’s first stop.

It includes:

- Pending customer requests in an accept/reject area
- Today’s timeline and bake work
- Daily production dashboard with accepted orders, ready shelf, active bakes, pickup windows, and shortages
- Visual fermentation display for the selected active bake
- Ready-to-go shelf summary
- Starter status and quick starter feed/check logging
- Order summary and daily capacity progress
- Quick links into Orders, Production > Kitchen, Menu, Business, Settings, and Storage

The goal is that the baker can open Today and know what needs attention without hunting through every tab.

### Orders

Orders supports both manually entered orders and cloud customer requests.

Owner order tools include:

- Branded Orders desk dashboard for the owner workflow
- Active order, pickup-today, next-pickup, and active-revenue summary cards
- Request intake panel for accepting customer web orders
- Pending online request inbox
- Accept request
- Reject request
- Comment on request
- Rejected history
- Open order detail
- Edit order details from list/detail views
- Complete bake button
- Delete order and release customer calendar capacity
- Customer notes
- Allergy notes
- Pickup location
- Payment method and payment status
- Venmo, Zelle, Cash, and custom payment notes
- Side pickup lane for today’s customer handoffs
- Upcoming flow panel for the next dated pickups
- Daily bake-slot capacity card
- Add-to-calendar export with step-by-step bake schedule
- Customer bake phase checkoffs
- Email/text notification links and automatic email hooks
- Active, ready, completed, and all-order views
- Order calendar with order placed, feed, start, and pickup events
- Dedicated Customers view for profile and history work

Calendar colors:

- Ordered/requested: green
- Starter feed: red
- Start bread: black
- Pickup: bold brown

The app also respects daily bake capacity so the customer calendar can lock out full pickup days.

### Customer profiles

Customer profiles can be saved and linked from online orders or customer accounts.

Each profile can store:

- Name
- Email
- Phone
- Address
- Allergies and food-safety notes
- Preferences
- Favorite items
- Payment notes
- Pickup/delivery notes
- Private baker notes
- Linked order history
- Account-linked profile status

Customer lists can be viewed as active, past, account-linked, or all customers.

### Production

Production is the owner area for making things. It contains Bread work and Liquid lab.

Bread work opens into the branded Bake desk with status cards for in-progress bakes, next step, starter readiness, and production signal. Liquid lab handles hot sauces, vinegars, infused oils, pH/salt planning, and safety logs.

Bread work is intentionally split by job:

- Plan: build a single bake timeline
- Kitchen: track active bakes currently in progress with named bakes and checklists
- Batches: group accepted orders into efficient production work
- Calendar: plan and block bake days
- Starters: manage starter profiles and feed history
- Liquid lab: hot sauce, vinegar, oil, and liquid safety tools

The Bake desk also includes a summary rail on larger screens with calendar load, active kitchen work, and upcoming saved bake plans. On phones, the same tools stack into a tighter flow so the baker can get from status to action quickly.

This area is where the app acts most like the missing production manager.

### Menu

Menu is the owner area for the product catalog and customer-facing shelf.

Use Menu for:

- Recipes and products
- Product photos
- Package pricing
- Customer-facing descriptions
- Ingredients and estimated nutrition
- Product availability and badges
- Ready-now shelf items
- Storefront preview

The clean rule: if it changes what customers can buy or see on a product card, it belongs in Menu.

### Business

Business is the owner area for records, money, and operations history.

Use Business for:

- Inventory
- Purchases and barcode imports
- Spending and stock trends
- Customer records
- Order history
- Product performance
- Owner cockpit alerts
- Batch trace records and reporting foundations

The clean rule: if it helps understand cost, stock, customers, or history, it belongs in Business.

### Settings

Settings is the owner area for rules and visibility.

Use Settings for:

- Bakery name and public intro
- Customer privacy controls
- Product type controls
- Customer option visibility
- Order capacity and lead time
- Pickup hours and pickup intervals
- Payment methods
- Customer notifications
- Email delivery settings
- Storefront announcements

The clean rule: if it changes how the bakery behaves or what options customers are allowed to use, it belongs in Settings.

### Storage

Storage is the owner area for protecting data.

Use Storage for:

- Exporting backups
- Restoring backups
- Previewing backup contents
- Undoing the last restore when available
- Checking local/cloud storage status

The clean rule: if it protects, restores, or moves records, it belongs in Storage.

## Recipe and product system

### Product types

The app supports product types instead of assuming everything is a sourdough loaf.

Current product types:

- Bread
- Yeast breads
- Bagels
- Buns / rolls
- Cakes
- Pastries
- Hot sauces
- Vinegars
- Infused oils
- Other item

Each product type can have:

- Customer-facing on/off visibility
- Default unit name such as loaf, half dozen, dozen, bottle, jar, cake, or item
- Default package and pricing presets
- Bake-capacity use per package
- Customer-facing description
- Safety and storage notes
- Customer options such as slicing, spice level, frosting style, gift note, or packaging preference
- Display order on the customer menu

The customer menu uses these product types as category tabs.

### Product availability controls

Products can be marked:

- Available
- Sold out
- Unavailable this week
- Hidden this week
- Preorder
- Ready now
- Spicy
- Contains dairy
- Gluten
- Limited batch

This gives the baker weekly control without deleting products.

### Customer product cards

Customer product cards are compact so the menu does not get crowded. Tapping a card opens a product window where customers can:

- View product photos
- Read the description
- See availability
- See badges
- Choose package size
- Choose quantity
- Select enabled customer options
- Read ingredients
- See formula details
- See estimated nutrition
- Read safety/storage notes

This keeps the storefront clean while still making each item feel detailed and professional.

### Recipe builder

The recipe builder supports:

- Recipe/product name
- Product type
- Formula mode
- Recipe photo URL or upload
- Photo description
- Availability
- Badges
- Yield
- Unit name
- Package pricing
- Bake-capacity units
- Ingredient categories
- Grams entry
- Baker’s percentage entry
- Automatic percentage calculation from grams
- Batch percentage mode for non-flour products
- Ingredient cost estimate from inventory
- Method notes
- Timeline controls
- Sourdough vs yeast handling

Ingredient categories include:

- Flour
- Liquid
- Starter / preferment
- Yeast / leavener
- Salt
- Sweetener
- Fat / oil
- Acid / vinegar
- Spice / herb
- Fruit / vegetable
- Culture / ferment
- Inclusion
- Other

For yeast breads, starter inputs are not required and sourdough-only timeline steps can be skipped. For custom recipes, the baker can choose which timeline variables apply.

### Flour database and flour science

The app includes a type-first flour database. Brand records sit under flour-type categories so the baker thinks first about how the flour behaves, then about which bag they bought.

Tracked flour effects include:

- Protein
- Ash or extraction notes where available
- Absorption
- Strength
- Dough fermentation effects
- Starter growth effects
- Hydration adjustments
- Structure and gas-retention notes

The app uses flour profiles to explain how common flours affect:

- Fermentation speed
- Starter activity
- Dough rise
- Water demand
- Gas retention
- Gluten strength
- Dough handling

Examples include bread flour, all-purpose flour, whole wheat, rye, spelt, einkorn, emmer/farro, durum/semolina, khorasan, barley, oat flour, buckwheat, and brand records such as King Arthur, Cairnspring, Central Milling-style records, Costco/Kirkland-style AP, Gold Medal, and other public-reference entries where available.

## Bake science and kitchen workflow

### Dynamic bake plan

The dynamic bake plan can work from:

- Start/mix time
- Desired finish time

It calculates a work plan using:

- Recipe type
- Dough temperature
- Hydration
- Starter ratio
- Starter/flour behavior
- Cold proof hours
- Yeast timing settings
- Stretch-and-fold settings
- Shape, proof, preheat, bake, and cooling windows

The baker can tune:

- Whether to use starter
- Whether to include bulk fermentation rules
- Rise/proof hours
- Number of stretch and folds
- Stretch-and-fold interval
- First fold timing
- Whether shaping is included
- Whether final proof is included
- Whether cold proof is included
- Preheat time
- Bake/cool timing

### Yeast bread behavior

Yeast breads are handled differently than sourdough:

- No starter is required
- Levain ratio is skipped
- Bulk fermentation language can be replaced by first rise
- Stretch-and-fold steps can be skipped
- Fixed rise and final proof hours can be prepopulated from yeast timing suggestions
- Dough temperature still matters
- Enriched doughs can be slower or need adjusted timing

This keeps sandwich bread, rolls, buns, and enriched yeast breads from being forced into a sourdough workflow.

### Bake desk > Kitchen

Kitchen is the live bench list for work in progress.

It can:

- Add a named active bake
- Start from a planned bake
- Start from a suggested production batch
- Select a recipe
- Skip starter fields for non-starter recipes
- Track mix time
- Track item count
- Track dough temperature
- Track cold proof only when the recipe uses it
- Display active bakes
- Show percent complete
- Provide checkboxes for each stage
- Include stretch-and-fold steps when enabled
- Mark a bake complete
- Choose which active bake appears in Today’s visual fermentation display

The “Start work,” “Optional suggestions,” and “In progress” areas are collapsible to save space on mobile.

### Bake desk > Batches

The Batches view groups accepted orders into production work.

It can:

- Group matching recipes by pickup day
- Calculate total items needed
- Work backward from pickup through cooling, bake, proof, mix, and starter feed
- Suggest batch order and staggered start times
- Show unmatched order lines
- Show ingredient requirements
- Compare against inventory
- Warn about shortages
- Include packaging such as paper bags
- Sync generated plans to the bake calendar
- Show a weekly production planner for pickups, feeds, mixes, bakes, and shortage pressure
- Build smart prep lists for scaling ingredients, bench staging, packaging, labels, and shortage-first shopping
- Print day sheets, batch sheets, labels, and shopping lists
- Optionally deduct stock when a bake is completed

Nothing starts automatically without the baker choosing to use it in Kitchen.

### Bake desk > Calendar

The calendar supports:

- Planned bakes
- Accepted-order bakes
- Starter feed events
- Start bread events
- Pickup events
- Unavailable bake days
- Capacity lockouts
- More than one event per day
- Scrollable event stacks

The customer calendar is limited by:

- Daily bake slots
- Order window
- Minimum lead time
- Pickup intervals
- Weekday and weekend pickup windows
- Unavailable days
- Starter-feed reservation rules

## Bake desk > Starters

Starters supports multiple starter profiles.

Each starter can store:

- Name
- Notes
- Flour blend
- Primary flour
- Optional second flour
- Flour percentages
- Hydration/feed ratio logs
- Temperature
- Rise multiple
- Feed notes

The starter feed calendar shows feed history, and estimates use:

- Feed ratio
- Temperature
- Flour blend
- Logged peak history
- Flour activity
- Flour gas-retention behavior

The goal is not just “did it double?” but “what does this flour and feed ratio mean for this culture?”

## Production > Liquid lab

Liquid lab covers non-bread fermented and infused products.

### Hot sauce calculator

The hot sauce lab helps design fermented hot sauces using:

- Pepper/produce grams
- Water grams
- Salt percentage
- Ferment style
- Room temperature
- Ferment days
- Target finished pH

It estimates:

- Salt grams to add
- Ferment pace
- Acid development
- Estimated pH
- Peak sour window
- Temperature and salt effects

It also explains why salt, temperature, mash/brine style, and pH measurement matter.

### Vinegar designer

The vinegar lab helps plan acetic fermentation using:

- Base volume
- Starting alcohol percentage
- Ferment temperature
- Oxygen setup
- Planned weeks

It estimates:

- Potential acidity
- Conversion time
- Ferment pace
- Dilution helper for high-alcohol bases

It explains ethanol-to-acetic-acid conversion, oxygen transfer, alcohol range, pH versus acidity, and heat stress.

### Infused oil designer

The oil lab handles infusion, not fermentation.

It models:

- Oil volume
- Ingredient type
- Cold, warm, or heated method
- Oil temperature
- Infusion time
- Extraction strength
- Water-risk class
- Storage cautions

The app warns strongly about fresh garlic/herb/chile oil risks and short refrigerated hold times unless a safe validated process is used.

### Liquid safety log

Safety logs can store:

- Product type
- Batch name
- Lot/batch code
- Batch date
- Quantity made
- Measured pH
- Salt percentage
- Shelf-life days
- Storage instructions
- Warning notes
- Batch recall notes

The app flags common issues such as missing pH, pH above 4.6 for acidified products, low salt in hot sauce, missing shelf life, and oil infusion risk notes.

Important: these are planning and traceability helpers, not a food-safety certification.

## Customer storefront

The customer storefront is designed to feel like a polished public bakery shelf:

- Loafers Home Bakery brand header with badge artwork
- Baker announcement near the top
- Large branded hero image using the Loafers banner mood
- Clear pickup, payment, and pickup-hours cards
- Product type tabs for the visible customer menu
- Premium compact product cards with badges, price, and add action
- Branded fallback imagery when a recipe does not yet have its own photo
- Ready shelf items when enabled
- “What’s baking this week” board below the main menu
- Reviews when enabled
- Customer account access when enabled
- Track My Bake when enabled
- Add to Home Screen prompt

Checkout flow:

1. Browse menu
2. Review cart
3. Choose pickup
4. Contact + payment
5. Send request

Payment options currently include:

- Venmo: `@Joshua-Ellis-162`
- Zelle: `9076161025`
- Cash: pay at pickup

Default pickup location:

`Three Bears, Delta Junction, AK`

Pickup hours can be controlled in Settings. Current configured defaults are:

- Weekdays: 7:00 AM to 8:30 AM
- Weekdays: 5:00 PM to 8:00 PM
- Weekends: 1:00 PM to 4:30 PM

### Customer accounts

Customer accounts use email and password rather than magic email links.

Supported customer account features:

- Sign in
- Sign up
- Password strength checks
- Password reset path
- Saved customer profile
- Saved allergies
- Saved preferences
- Saved address/pickup note
- Default payment method
- Favorite product
- Order history
- Reorder favorite item

Password rules include:

- At least 12 characters
- Lowercase letter
- Uppercase letter
- Number
- Symbol
- Does not include the customer email/name

### Customer privacy settings

The owner can control:

- Allow guest checkout
- Require sign-in for orders
- Show Track My Bake publicly
- Show reviews publicly
- Show ready shelf publicly
- Allow customer reorder
- Allow customer profile saving
- Allow feedback/suggestions

These controls let the baker decide how public or account-based the storefront should be.

### What’s baking this week

The customer page can now summarize current availability before the customer starts browsing the full menu.

It shows:

- Ready-now shelf items
- Products marked ready now
- Limited-batch, preorder, and spicy items
- Planned menu items available for the week
- Counts by product type
- Starting prices

The weekly board is generated from the same product availability, badges, and ready shelf records already used by the customer menu. The baker does not need to maintain a second weekly menu.

### Track My Bake

Track My Bake lets a customer see order status and bake progress when enabled.

The baker can check off phases such as:

- Starter fed
- Dough mixed
- Folds
- Shaped
- Proofing
- Baking
- Cooling
- Ready
- Picked up / completed

Email links can point customers back to the tracking view.

## Ready-to-go shelf

Ready shelf is for items already made and available now.

It supports:

- Add from saved recipe
- Add custom shelf item
- Customer-facing item details
- Price per shelf item
- Quantity available
- Days old
- Recipe details where available
- Customer card visibility
- Delete shelf item

This is useful for extra loaves, day-old goods, bottled sauces, or small ready-now batches.

## Labels and printables

Production includes print and copy tools:

- Production day sheet
- Batch sheet
- Smart prep list
- Order labels
- Label and compliance review sheet
- Shopping list
- CorePrint CTP500BR mini-printer copy/paste labels
- Storefront QR code

The CorePrint label text includes:

- Bakery name
- Customer
- Pickup
- Item
- Allergy note
- Payment state
- Request code when available
- Storefront URL / QR prompt

If there are no active production orders, it can still create a storefront QR slip so customers can scan and order.

### Label and compliance center

The Label and Compliance Center is a practical review area for active production labels.

It helps the baker review:

- Customer/order label count
- Missing recipe ingredient matches
- Missing batch/order codes
- Storage notes
- Major allergen flags
- Liquid-product safety-log reminders
- Batch trace links where available

It also creates copy/paste label text for the CorePrint CTP500BR workflow.

Allergen reminders include milk, egg, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans, and sesame. This is a review helper only; the baker still verifies the final product label and local rule requirements.

## Inventory, purchases, and business tracking

The Business area tracks the money and supplies side.

It includes:

- Inventory item list
- Amount on hand
- Unit
- Restock target
- Unit cost
- Inventory item deletion
- Purchase logging
- Purchase history
- Spending chart
- Stock value
- Revenue and spend summaries
- Order history
- Customer directory
- Product ranking
- Owner cockpit alerts
- Daily checklist
- Better reporting foundation
- Batch trail foundation

### Barcode and scanner import

Purchases can be added with:

- Camera barcode scan when browser support is available
- Manual barcode entry
- Clipboard paste
- Bluetooth scanner / scanner-keyboard input
- Open Food Facts lookup
- CSV import from scanner apps such as Orca Scan-style exports

For each scanned or imported purchase, the owner can fill in:

- Inventory item
- New item name
- Barcode
- Quantity purchased
- Unit
- Total cost
- Purchase date
- Notes

Saving a purchase can update stock and cost trends.

## Storage and backup

Loafers stores owner-side records locally and can also connect to cloud features.

The Storage center can:

- Export a versioned JSON backup
- Restore from a backup
- Preview backup contents before restore
- Keep an automatic recovery copy before restore
- Undo the last restore
- Include orders, customer profiles, recipes, inventory, expenses, bake plans, kitchen bakes, liquid safety logs, starters, and starter feed logs

On iOS/native Capacitor builds, the app uses native Preferences storage. On the web, it uses browser storage and cloud features where connected.

## Cloud system

The cloud layer uses Supabase.

Supabase handles:

- Bakeries
- Bakery owner/membership permissions
- Public storefront loading
- Products
- Customer orders
- Customer order items
- Customer profiles
- Customer account profile details
- Capacity reservations
- Unavailable days
- Reviews and feedback
- Email delivery logs
- Public order submission rules
- Row-level security policies

The browser app only uses the public Supabase URL and anon key. Owner-only cloud actions depend on Supabase authentication and membership checks.

## Email notifications

Automatic email updates use a Supabase Edge Function and Resend.

Email events can include:

- Order accepted
- Order rejected/commented
- Bake progress changed
- Order ready
- Order completed
- Test email

Settings can control:

- Email updates on/off
- Text update preference display
- Automatic email on/off
- Reply-to address
- Which event types send automatically
- Recent delivery log visibility

Texting is currently treated as opt-in/contact workflow rather than a full SMS-provider integration.

## Installable app behavior

Loafers is built as a Progressive Web App.

It includes:

- App manifest
- App icon
- Add to Home Screen support
- Mobile standalone display
- Offline fallback page
- Local font files
- Customer menu shortcut
- Today shortcut

Best near-term phone install path:

1. Open the owner app or storefront in Safari/Chrome.
2. Use Share / menu.
3. Choose Add to Home Screen.
4. Open Loafers from the new icon.

A native iOS Capacitor shell exists, but publishing to the App Store still requires macOS, Xcode, signing, and an Apple Developer account.

## Daily owner workflow

### Morning start

1. Open Today.
2. Check pending requests.
3. Accept or reject new requests.
4. Review today’s accepted orders and pickups.
5. Check shortages and inventory warnings.
6. Review starter status and log a quick feed/check if needed.
7. Open Production > Bread work > Kitchen if anything is hitting the bench.

### Planning a bake

1. Open Production.
2. Choose Bread work.
3. Use Plan for a one-off bake or Batches for accepted customer orders.
4. Choose whether to start from mix time or finish by pickup time.
5. Confirm the recipe, dough temperature, quantity, and proof timing.
6. For sourdough, confirm starter and levain ratio.
7. For yeast breads, confirm rise/proof timing instead of starter settings.
8. Add the bake to Kitchen when you actually start work.

### Running active dough

1. Open Production > Bread work > Kitchen.
2. Name the bake so it is easy to recognize.
3. Check off each stage as it happens.
4. Use Show on Today to make that bake drive the visual fermentation display.
5. Complete the bake when finished.

### Handling pickups

1. Open Orders.
2. Use active/ready views.
3. Open the order detail.
4. Update payment status if needed.
5. Mark bake phases or ready/completed.
6. Send/update customer notifications if enabled.
7. Complete the bake/order once picked up.

### Managing the storefront

1. Open Menu.
2. Update recipes/products.
3. Add photos and customer descriptions.
4. Mark products sold out, preorder, limited, hidden, or ready now.
5. Add ready shelf items.
6. Use Preview to see what customers see.
7. Adjust Settings if weekly customer options should change.

### Logging business records

1. Open Business.
2. Log purchases.
3. Scan or type barcodes when useful.
4. Import scanner CSV files when buying many items.
5. Review inventory levels and cost trends.
6. Check customer and order history.

### Backup habit

1. Open Storage.
2. Export a backup before major changes.
3. Keep a copy somewhere outside the browser/device.
4. Restore only after previewing the backup.

## Setup checklist for a new bakery

### 1. Basic bakery settings

Go to Settings and configure:

- Bakery name
- Customer intro
- Pickup location
- Payment methods
- Bakery announcement
- Daily bake slots
- Order window
- Minimum lead time
- Pickup interval
- Weekday pickup hours
- Weekend pickup hours

### 2. Product types

For each product type:

- Decide whether customers should see it
- Set the default unit name
- Set default package/pricing presets
- Set bake-capacity use
- Add customer-facing description
- Add safety/storage notes
- Enable or disable customer options
- Choose display order

### 3. Menu products and recipes

In Menu:

- Add recipes/products
- Choose product type
- Add photo
- Enter ingredients in grams or percentages
- Set package pricing
- Add badges
- Add availability notes
- Review customer-facing details

### 4. Cloud/storefront

If cloud is connected:

- Confirm Supabase URL and anon key are present in deployment secrets
- Confirm bakery owner membership exists
- Publish products/settings
- Test the customer order page
- Accept a test order
- Confirm capacity calendar updates

### 5. Email

If Resend email is connected:

- Confirm Resend API key is stored in Supabase function secrets
- Confirm sender/from email is verified
- Send a test email
- Confirm delivery log appears
- Test accepted/ready/completed order email events

### 6. Backups

Before real use:

- Export a backup
- Save it outside the browser
- Confirm restore preview works

## Local development

Install dependencies:

```powershell
npm install
```

Run the app locally:

```powershell
npm run dev
```

Build the app:

```powershell
npm run build
```

Preview the built app:

```powershell
npm run preview
```

Sync native iOS shell files:

```powershell
npm run ios:sync
```

Open iOS project on macOS:

```powershell
npm run ios:open
```

## Technical stack

Frontend:

- React
- Vite
- CSS modules/style file approach
- Lucide icons
- PWA manifest and service worker
- Capacitor shell for future native iOS path

Cloud:

- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase Edge Functions
- Resend email API

Deployment:

- GitHub Pages
- Optional Starlight VM deployment workflow
- Local `dist` build output

Data:

- Local browser/native storage for owner working records
- Supabase for customer storefront, order requests, accounts, and synced cloud records
- JSON export/import for backup and recovery

## Changelog

This changelog is written as a product history, not a line-by-line commit log.

### Initial bakery OS foundation

- Created the mobile-first Loafers Bakery OS shell
- Added Today, Orders, Bake, Recipes, Trends/Business, and Settings foundations
- Added seed orders, recipes, inventory, and starter records
- Added local persistence
- Added iPhone-style responsive layout

### Order management improvements

- Added order details
- Added customer notes
- Added delete order support
- Added sample/original record removal
- Added rejected order history
- Added complete bake flow
- Added dynamic order summary counts
- Added accepted orders into bake calendar views

### Starter management

- Added editable starter profiles
- Added starter names, notes, flour types, and flour blend percentages
- Added starter feed calendar
- Added feed ratio and temperature logging
- Added starter growth/rise estimates using flour and temperature behavior
- Added second-flour removal and optional flour blend controls

### Dynamic bake planning

- Added dynamic bake plan based on start time or finish time
- Added science-based starter/feed/bulk/proof timing curves
- Added flour, temperature, hydration, and recipe effects
- Added month calendar view
- Added accepted order bakes to the calendar
- Added blocked/unavailable bake days
- Added capacity lockout rules

### Recipe builder and product catalog

- Added recipe editing
- Added add/remove ingredients
- Added grams entry and percentage calculation
- Added product photos
- Added package pricing for loaves, half dozens, dozens, bottles, cakes, jars, and custom packs
- Added customer-facing item details
- Added estimated nutrition
- Added non-bread items such as cakes, hot sauces, vinegars, and infused oils
- Added yeast breads as a separate product type
- Added recipe versioning so formula changes create traceable version records
- Added recipe-level labor, overhead, packaging, cost, margin, and profit-per-bake-slot planning

### Flour science

- Added flour profiles and flour database
- Added type-first categories with brand records underneath
- Added protein, ash, absorption, and strength fields where public records are available
- Added dough and starter science explanations
- Added flour effects inside recipes and starter profiles
- Made flour database collapsible and default-collapsed

### Customer storefront

- Added public customer order page
- Added menu categories/tabs
- Added bakery announcements
- Added customer-facing “What’s baking this week” board
- Added compact product cards and product detail modals
- Added cart-based checkout flow
- Added cart editing
- Added customer pickup calendar
- Added allergies
- Added payment details for Venmo, Zelle, and Cash
- Added pickup location
- Added reviews and suggestions
- Added public review visibility controls
- Added Track My Bake
- Added customer account/profile/reorder support
- Removed public guest lookup when it was not appropriate
- Reworked sign-in away from email magic links toward email/password accounts

### Capacity, pickup, and privacy controls

- Added daily bake capacity
- Added +1 day starter-feed reservation logic
- Added 30-day ordering window controls
- Added minimum lead time
- Added pickup interval settings
- Added weekday/weekend pickup hours
- Added unavailable bake days
- Added owner toggles for guest checkout, required sign-in, public tracking, reviews, ready shelf, reorder, and profile saving
- Added server-side order policy migration hooks for stricter guest-order enforcement

### Notifications and email

- Added customer email/text preference fields
- Added automatic email notification path
- Added Resend Edge Function
- Added email test action
- Added event templates and delivery logging
- Fixed owner membership and table permission issues around the email function
- Added links back to customer tracking in email context

### Ready shelf

- Added prebaked ready-to-go shelf
- Added days-old tracking
- Added editable price per shelf item
- Added customer visibility setting
- Added ready shelf to customer menu
- Added recipe selector for quick adding saved recipes
- Added custom ready shelf item support
- Fixed command center refresh behavior after adding shelf items

### Liquid lab and safety

- Added Liquid tab
- Added hot sauce fermentation calculator
- Added vinegar designer
- Added infused oil designer
- Added pH, salt, shelf-life, storage, warning, and recall logging
- Added science and chemistry explanations for liquid products
- Added safety cautions for acidified foods and infused oils

### Inventory and business tools

- Added inventory item add/edit/delete
- Added costs and expenditure charts
- Added purchase logging
- Added barcode reader/import support
- Added manual barcode input
- Added Open Food Facts lookup
- Added scanner CSV import support
- Renamed loaves ordered trend language toward orders
- Added clickable order history and customer history/detail views
- Added owner cockpit with alerts, checklist, reporting, batch trail, and product ranking foundations

### Production command center

- Added daily production dashboard
- Added accepted orders, ready shelf, in-progress bakes, pickup windows, and shortages in one place
- Added product availability control screen
- Added kitchen board for in-progress bakes
- Added active bake naming
- Added checklist steps including stretch and folds where recipe settings require them
- Added batch/stagger suggestions
- Added home page visual fermentation tied to selected named bake
- Added weekly production planner
- Added smart prep lists for ingredient scaling, bench staging, packaging, label counts, and shortage-first shopping
- Added batch trace record creation for completed orders and completed Kitchen bakes

### Labels and printables

- Added production day mode
- Added batch sheets
- Added order labels
- Added shopping list forecast
- Added CorePrint CTP500BR mini-printer copy/paste label format
- Added storefront QR code on labels and slips
- Added Label and Compliance Center
- Added copy/paste compliance label text
- Added major-allergen review reminders
- Added liquid product safety-log reminders

### PWA and hosting

- Added installable web app manifest
- Added app icons
- Added offline page/service worker path
- Added GitHub Pages deployment
- Added Starlight VM deployment workflow
- Added Starlight deploy documentation
- Added iOS Capacitor shell foundation for future native work

### Recent polish

- Removed the AI assistant section because it was not adding enough value
- Improved mobile input alignment and collapsible settings cards
- Made Settings product types, order protection, pickup schedule, status messages, and email delivery sections more space-efficient
- Improved customer menu density
- Improved responsive mobile/desktop behavior
- Fixed order calendar readability/layout on wide screens
- Added owner cockpit/business pro workflow sections
- Added true product costing and pricing intelligence panels
- Added batch trace records to backup/restore
- Added Loafers Home Bakery brand-kit foundation using the supplied round badge and advertising banner
- Redesigned the customer storefront with a polished public-shop layout, refined hero, premium menu tabs, branded product cards, and a cleaner sticky cart
- Began the deep owner UI refresh one group at a time, starting with Orders
- Redesigned Orders into a branded owner desk with summary cards, request intake, cleaner List/Calendar/Customers workspace, today pickup lane, upcoming flow, capacity card, and refreshed order cards
- Tightened the Orders calendar cell labels so mobile month view remains readable
- Refreshed Bake / Production into a branded Bake desk with quick status cards, clearer Plan/Kitchen/Batches/Calendar/Starters tabs, a desktop summary rail, and a tighter mobile Production chooser
- Added scroll-position polish so switching Bread work and Liquid lab opens from the top instead of landing mid-page
- Cleaned up product documentation naming around Today, Orders, Production, Bread work, Bake desk, Menu, Business, Settings, and Storage
- Added a clear structure map explaining what old rough names became and where each owner workflow belongs

## Known limitations and cautions

- Nutrition values are estimates based on ingredient averages, not lab-tested labels.
- Food-safety tools help with planning and records, but they do not replace local rules, process authority review, pH calibration, or commercial food-safety validation.
- SMS/text notifications are not yet a full provider-backed SMS integration.
- Native iOS App Store release requires macOS, Xcode, signing, and an Apple Developer account.
- Cloud security depends on keeping Supabase service-role keys out of the frontend and maintaining correct Supabase row-level-security policies.
- Offline mode can show the app shell, but cloud order submission and email require network access.

## Recommended next improvements

- Add a stronger owner login gate for local owner screens when used on shared devices.
- Add tax/fee settings if the bakery needs more formal checkout totals.
- Add real SMS provider integration if text automation becomes important.
- Add richer batch recall workflows for ingredient lots, finished product lots, and customer contact lists.
- Add customer-facing pickup reminders.
- Add end-to-end tests for customer checkout, capacity lockout, order acceptance, and email event generation.
