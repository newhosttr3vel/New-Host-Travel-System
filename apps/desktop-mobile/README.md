# New Host Travel — Desktop & Mobile

This local-first Tauri 2 application sits alongside the existing Next.js web app. It does not overwrite the web app. The interface supports Arabic/English, responsive layouts, customer and supplier records, reservations, soft archive, and JSON backup.

## Data behavior

- Windows and Android native builds use a SQLite database through the Tauri SQL plugin.
- The browser preview uses browser local storage.
- Data is local to each device in this first phase. It does not sync the PC and phone, and it does not connect to Google Sheets.
- Use sample data only until login, shared sync, permissions, backup recovery, and restore testing are complete.

## Prerequisites

- Node.js 22 or newer.
- Windows builds require Rust, Microsoft C++ Build Tools, and WebView2 as listed in the Tauri v2 guide.
- Android builds require Android Studio, Android SDK, and a compatible Java/JDK.
- The SQL plugin requires Rust 1.90 or newer.

## Browser preview

From this directory, run:

    npm install
    npm run dev

Open http://localhost:1420. Browser preview data remains in that browser's local storage.

## Windows desktop

After installing the Tauri prerequisites, run:

    npm install
    npm run tauri:dev

Generate the New Host Travel app icon and build installable bundles:

    npm run tauri:icons
    npm run tauri:build

Tauri places native bundles beneath src-tauri/target/release/bundle/ on a compatible build machine.

## Android

After installing the Android prerequisites:

    npm install
    npm run tauri:android:init -- --ci
    npm run tauri:icons
    npm run tauri:android:dev

To build an Android package:

    npm run tauri:android:build

Android signing and distribution still need configuration before sharing a production APK.

## Next phases

1. Validate Windows packaging and Android build on their native toolchains.
2. Add automated tests for data validation, duplicate references, and backup/restore.
3. Add secure team sign-in and synchronization through a protected shared service. Never ship server credentials in desktop or mobile bundles.
4. Add complete travel and financial workflows; this is a starting app foundation, not a complete audited ERP.