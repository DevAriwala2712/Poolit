# Poolit

Poolit is a hostel food pooling app that lets students join shared meal orders and lets vendors manage live slots, stock, dispatch, and revenue tracking in one streamlined dashboard.

## Why this project?

Campus food ordering often breaks down because students order individually, vendors struggle with unpredictable demand, and hostel dining windows are hard to manage. Poolit solves this by creating a shared ordering flow where:

- students pick a hostel vendor and add items to a pooled slot,
- the fee increases as more students join the same slot,
- vendors can monitor active pools, restock inventory, and close/dispatch orders,
- order history and revenue become visible in a simple vendor dashboard.

## Features

- Hostel-based food ordering flow
- Shared meal slots with live countdown timers
- Dynamic delivery fee calculation based on order count
- Searchable hostel and menu experiences
- Vendor dashboard for open and past slots
- Inventory tracking with stock alerts and restocking actions
- Demo-friendly flow for testing slot lifecycle and dispatch processes

## Tech stack

- React + TypeScript
- Vite
- React Router
- Local storage state management for demo persistence

## Project structure

```bash
src/
  App.tsx
  components/
  domain/
  hooks/
  routes/
```

## Getting started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

The app will start in development mode with the Vite preview server.

### Build for production

```bash
npm run build
```

## Demo experience

This project is designed as a front-end prototype that simulates real hostel ordering behavior using seeded vendors, live slots, and interactive state changes.

## License

This project is for educational and demo purposes.

## Contributing

Pull requests and suggestions are welcome. For larger changes, open an issue first so the feature direction can be discussed.
