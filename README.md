# Loafers Bakery OS

Loafers is a mobile-first bakery operating system for a solo home baker.

## Live web app

After GitHub Pages is enabled, the installable version is available at:

`https://loafer-hub.github.io/loafers-bakery-os/`

## Included in this prototype

- Daily bake dashboard with schedule, starter readiness, orders, revenue, and oven capacity
- Bread order entry, status filters, customer search, and local persistence
- Editable bake timeline with starter-peak warning
- Baker's-percentage formulas that scale automatically by loaf count
- Starter health, feeding history, temperature, rise, and trend logging
- Recipe library with production weights and method notes
- Inventory warnings, sales trends, customer metrics, pricing, and bakery settings surfaces
- Installable web-app manifest and responsive iPhone layout

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

## Product status

This is a polished, interactive front-end MVP with an iOS-native Capacitor shell. Orders, schedules, and starter logs use Capacitor Preferences on iOS and migrate existing browser data automatically.

## iOS project

The generated Xcode project lives in `ios/App`.

```powershell
npm run ios:sync
npm run ios:open
```

Opening and signing the iOS app requires macOS, Xcode 26 or newer, and an Apple Developer account. The project targets iOS 15 and newer.

The iOS foundation includes:

- Bundle identifier `com.loafers.bakery`
- Native app icon and launch screen
- Native Preferences storage
- Status-bar and splash-screen integration
- Apple privacy manifest for UserDefaults
- Offline local fonts

For an App Store release, the next production phases should add:

- Secure sign-in and cloud sync
- Customer order-request links and payment processing
- Notifications and calendar reminders
- Database backups, exports, taxes, and multi-device sync
