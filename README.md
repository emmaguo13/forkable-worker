# forkable-worker

`forkable-worker` is a TypeScript Notion Worker that turns Forkable lunch ordering into worker tools. It authenticates to Forkable with your session cookie, reads the available menus for a date, shows your current order, and can place or replace a meal order on your behalf.

## What This Repo Can Do

- Expose `getRestaurantsAndMealsForDate` to list every orderable meal for a `YYYY-MM-DD` date, grouped by delivery location and restaurant.
- Expose `getCurrentOrderForDate` to show your current order for a date, optionally narrowed to one location.
- Expose `orderMealForDate` to place or replace an editable order by exact `mealId` + `menuId` or by a meal-name search.
- Validate date format, location filters, ambiguous meal matches, and required Forkable modifier selections before sending an order.
- Return structured results that are suitable for a Notion worker tool surface.

## How It Works

- [`src/index.ts`](./src/index.ts) registers the worker and its three public tools.
- [`src/forkable.ts`](./src/forkable.ts) wraps the Forkable GraphQL API and contains the matching, validation, and order-submission logic.
- [`src/forkable.test.ts`](./src/forkable.test.ts) covers the main behavior: menu listing, current-order lookup, exact ordering, ambiguity handling, and required selection validation.

The worker authenticates by sending your Forkable `_easyorder_session` cookie as the value of `FORKABLE_SESSION_COOKIE`. The worker acts as the Forkable user tied to that session.

## Tool Summary

### `getRestaurantsAndMealsForDate`

Input:

```json
{
  "date": "2026-03-25"
}
```

What it returns:

- Deliveries for that date.
- Each delivery's location metadata.
- Restaurants and meals available at that location.
- Meal list entries that include exact `mealId` and `menuId`, which are the safest identifiers to use when ordering.

### `getCurrentOrderForDate`

Input:

```json
{
  "date": "2026-03-25",
  "locationId": null,
  "locationName": null
}
```

What it returns:

- Your current order, if any, for each delivery on that date.
- The delivery location and address.
- Chosen selections and any special instructions on the existing order.

### `orderMealForDate`

Input:

```json
{
  "date": "2026-03-25",
  "mealName": null,
  "mealId": 501,
  "menuId": 10,
  "restaurantName": null,
  "locationId": 3916,
  "locationName": null,
  "instructions": "No onions",
  "selections": [
    { "modifier": "Choose Side", "option": "Salad" }
  ]
}
```

Behavior:

- Prefers exact `mealId` + `menuId` ordering.
- Supports `mealName` substring matching when exact IDs are not known.
- Lets you narrow matches with `restaurantName`, `locationId`, or `locationName`.
- Orders only editable deliveries.
- Replaces an existing order for the same delivery if one already exists.
- Fails with a clear error when multiple meals match or when required modifier selections are missing.

## Local Setup

Prerequisites:

- Node.js `>=22`
- npm `>=10.9.2`
- A Forkable account with an active session

Install dependencies:

```sh
npm install
```

Create a local `.env` file:

```dotenv
FORKABLE_SESSION_COOKIE=your_easyorder_session_cookie_value
```

Important:

- Use only the cookie value, not the entire `Cookie:` header.
- Do not commit this value.
- If the session expires, the worker will stop working until you refresh the cookie.

Validate the repo:

```sh
npm run check
npm test
npm run build
```

The compiled worker is emitted to `dist/`.

## What You Need To Add To Deploy Your Own Copy

This repo does not currently include checked-in deployment config or a deploy script. To deploy your own copy, you need to add your own worker config and secrets.

### 1. Add your worker config files

These files are intentionally gitignored, so you create them locally with your own IDs:

`workers.json`

```json
{
  "version": "1",
  "environment": "dev",
  "workspaceId": "your-workspace-id"
}
```

What you need to supply:

- `workspaceId`: the Notion workspace where this worker will live.
- `workerId`: the production worker identifier for your deployed worker.

### 2. Add the Forkable secret

You need to provide `FORKABLE_SESSION_COOKIE` in both places:

- Your local `.env` for development.
- Your deployed worker environment or secret store.

Without that secret, the worker cannot authenticate to Forkable.

### 3. Add your own deployment workflow

The repo currently only ships:

- `npm run build`
- `npm run check`
- `npm test`

If you want one-command deployment, add the scripts or CLI integration that match your Notion Workers environment. This repo assumes you already have a Notion Workers deployment path and just need the worker source, config files, and secret values.

## Customizing It

If you want to make this worker your own, the usual changes are:

- Rename or extend tools in [`src/index.ts`](./src/index.ts).
- Add new Forkable GraphQL queries or mutations in [`src/forkable.ts`](./src/forkable.ts).
- Add tests in [`src/forkable.test.ts`](./src/forkable.test.ts) before changing order logic.
