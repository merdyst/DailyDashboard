# My Daily Dashboard

A personal daily dashboard: savings tracker, NoFap streak, reading streak, and a
collapsible workout plan. Built with React + Vite + Tailwind CSS. All data is
saved to your browser's `localStorage`, so it survives refreshes and restarts.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (includes `npm`)

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

This starts a dev server and prints a local URL (usually `http://localhost:5173`).
Open it in your browser — it should open automatically. Edits to any file in
`src/` hot-reload instantly.

## Build for production

```bash
npm run build
```

Outputs a static, optimized build to `dist/`. Preview it with:

```bash
npm run preview
```

## Project structure

```
daily-dashboard/
├── index.html          # HTML entry point (Vite mounts React here)
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx         # React entry point
    ├── App.jsx          # The dashboard component (all app logic/UI)
    └── index.css        # Tailwind directives
```

## Notes

- Data is stored under these `localStorage` keys: `transactions`,
  `noFapLastReset`, `readingDates`, `workoutPlan`, `darkMode`.
- Clearing your browser's site data for `localhost` will reset the dashboard.
- Nothing is sent to any server — everything runs and stays in your browser.
