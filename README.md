# PDFloom

A PDF template designer and report-generation API built on NestJS + MongoDB + Handlebars-to-PDF, with inventory/stock-tracking as the demo domain.

## Stack

- **NestJS** (Express platform) + TypeScript
- **MongoDB** via Mongoose (`@nestjs/mongoose`)
- **Handlebars** templates rendered to **PDF** via Puppeteer
- **JWT auth** (`@nestjs/jwt` + `passport-jwt`), bcrypt password hashing
- **Docker** / Docker Compose (app + MongoDB)
- **Jest** unit + e2e tests

## Domain

- **Auth** — this is a public service: almost everything works without logging in. JWT login/register is optional and only gates *saving* a template (`POST`/`PATCH /templates`) — browsing, editing in the editor, live-previewing, and generating any PDF all work anonymously. A default admin user (`admin` / `admin123`) is seeded automatically on first boot if no users exist yet.
- **Products** — CRUD, SKU-uniqueness check, low-stock query (`quantity <= lowStockThreshold`)
- **Stock movements** — `IN` / `OUT` / `ADJUSTMENT` records that atomically adjust a product's quantity; an `OUT` that would drive quantity negative is rejected (`409 Conflict`)
- **Templates** — a drag-and-drop PDF template designer (frontend) backed by a compiler (`src/templates/template-compiler.ts`) that turns a visual layout into real Handlebars source, saved to Mongo. Supports text, data-field, table, and image elements.
- **Reports** — `/reports/stock-html` / `/reports/stock-pdf` render the built-in inventory template; `/reports/custom/:templateId/{html,pdf}` render a saved custom template; `/reports/preview-pdf` renders an unsaved in-progress layout for the editor's live preview.

## Running locally

```bash
cp .env.example .env
npm install
npm run start:dev
```

Requires a MongoDB instance reachable at `MONGODB_URI` (defaults to `mongodb://localhost:27017/pdffloom`). Set `JWT_SECRET` in `.env` to something real outside of local dev.

## Running with Docker Compose

```bash
docker compose up --build
```

This starts MongoDB and the API together; the API is available on `http://localhost:3000`.

## Puppeteer / Chromium note

`npm install` skips Puppeteer's bundled Chromium download (`PUPPETEER_SKIP_DOWNLOAD=true`). The Docker image installs `chromium` via `apt` instead and points `PUPPETEER_EXECUTABLE_PATH` at it. For local (non-Docker) use, either:

- run `npx puppeteer browsers install chrome`, or
- set `PUPPETEER_EXECUTABLE_PATH` in `.env` to a local Chrome/Edge/Chromium install

## Tests

```bash
npm test          # unit tests (mocked Mongoose models — no DB required)
npm run test:e2e  # boots the full app against an in-memory MongoDB (mongodb-memory-server)
```

`test:e2e` exercises the full flow: create product (no auth) → record IN/OUT stock movements → verify resulting quantity → reject over-drawing stock → generate the PDF stock report → confirm templates are publicly browsable but saving one without a token is rejected with `401`.

> **Known Windows caveat:** `mongodb-memory-server` downloads its own `mongod` binary, which has occasionally failed to start on some Windows setups (antivirus interference with a freshly-extracted `.exe` is the usual cause). If `test:e2e` fails to boot Mongo locally, run `docker compose up -d mongo` and point `MONGODB_URI` at it instead, or run the e2e suite in CI/Linux.

## API quick reference

| Method | Route                          | Auth      | Description                                    |
| ------ | ------------------------------- | --------- | ----------------------------------------------- |
| POST   | `/auth/register`                 | Public    | Create a user, returns a JWT                    |
| POST   | `/auth/login`                    | Public    | Log in, returns a JWT                           |
| POST   | `/products`                     | Public    | Create a product                                |
| GET    | `/products`                     | Public    | List all products                               |
| GET    | `/products/low-stock`           | Public    | Products at or below their threshold            |
| GET    | `/products/:id`                 | Public    | Get one product                                 |
| PATCH  | `/products/:id`                 | Public    | Update a product                                |
| DELETE | `/products/:id`                 | Public    | Delete a product                                |
| POST   | `/stock/movements`               | Public    | Record an IN/OUT/ADJUSTMENT movement            |
| GET    | `/stock/movements/:productId`    | Public    | Movement history for a product                  |
| GET    | `/templates`                     | Public    | List saved PDF templates                        |
| POST   | `/templates`                     | Required  | **Save** (create) a template                    |
| PATCH  | `/templates/:id`                 | Required  | **Save** (update) a template                    |
| DELETE | `/templates/:id`                 | Public    | Delete a template                               |
| POST   | `/templates/upload-image`        | Public    | Upload an image (multipart), returns a data URI |
| GET    | `/reports/stock-html`            | Public    | Rendered inventory report (HTML)                |
| GET    | `/reports/stock-pdf`             | Public    | Rendered inventory report (PDF)                 |
| GET    | `/reports/custom/:id/{html,pdf}` | Public    | Rendered custom template report                 |
| POST   | `/reports/preview-pdf`           | Public    | Renders an unsaved in-progress layout           |
| GET    | `/reports/context`               | Public    | Raw report data (for the editor's live values)  |

Only the two "save a template" routes require a token — everything else, including designing and previewing a template end-to-end, works without an account.
