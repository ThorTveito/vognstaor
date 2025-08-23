
# Bus Departure Display

A real-time bus departure display built with Next.js. Shows upcoming departures for selected bus lines at a chosen stop, with live updates and service messages.

## Features

- Real-time bus departure info from Entur API
- Select stop and bus lines to display
- Shows delays and service messages
- Responsive, modern UI
- Customizable number of departures per line

## Getting Started

1. **Install dependencies:**
	```bash
	npm install
	```

2. **Run the development server:**
	```bash
	npm run dev
	```
	Open [http://localhost:3000](http://localhost:3000) in your browser.


## Finding Stop Place ID

To find the stop place ID, use the Entur GraphQL Explorer:

- [Entur GraphQL Explorer – Journey Planner V3](https://api.entur.io/graphql-explorer/journey-planner-v3)
- Search for your stop by name and look for the `id` field in the results.
- Tip: Use the search function and look for "id" in the response.

## Usage

- On first launch, enter the stop place ID and select which bus lines to display.
- Choose how many departures per line to show.
- The display updates automatically every 30 seconds.
- Service messages (if any) are shown in a yellow bar under the relevant bus line.

## Customization

- Edit `app/page.jsx` for main display logic.
- UI components are in `components/ui/`.
- Styles are in `app/globals.css`.

## API

Uses Entur’s Journey Planner GraphQL API for live data.

