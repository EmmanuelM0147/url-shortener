# URL Shortener API

A REST API that creates short links, redirects with click tracking, and exposes basic analytics.

## Tech stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Docker

## Setup (local with Docker)

1. Clone the repository.
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Fill in values in `.env` (defaults work for local Docker). Ensure `DATABASE_URL` uses the Docker service hostname `db`:
   ```
   DATABASE_URL=postgresql://user:password@db:5432/url_shortener
   ```
4. Start the stack:
   ```bash
   docker compose up --build
   ```

Migrations run automatically on startup before the server begins listening.

The API is available at `http://localhost:8080`.

## Setup (local without Docker)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set `DATABASE_URL` in `.env` to point at your local PostgreSQL instance, for example:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/url_shortener
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/links` | Create a short link |
| `GET` | `/api/links` | List all links |
| `GET` | `/:slug` | Redirect to the original URL (302) |
| `DELETE` | `/api/links/:slug` | Delete a link |
| `GET` | `/api/links/:slug/analytics` | Click analytics for a link |
| `GET` | `/health` | Health check with DB connectivity |

### `POST /api/links`

Create a short link.

**Body (JSON):**

| Field | Required | Description |
|-------|----------|-------------|
| `target_url` | Yes | Destination URL |
| `slug` | No | Custom slug (3–20 chars, alphanumeric + hyphens). Auto-generated if omitted. |
| `expires_at` | No | ISO8601 expiry datetime (must be in the future) |

**Responses:** `201` created link, `400` validation error, `409` slug already taken, `429` rate limited.

### `GET /api/links`

Returns all links ordered by `created_at` descending, including `click_count`.

**Responses:** `200` array of link objects.

### `GET /:slug`

Redirects to `target_url` with `302`. Increments `click_count` and logs a `click_events` row.

**Responses:** `302` redirect, `404` link not found or expired.

### `DELETE /api/links/:slug`

Deletes a link by slug.

**Responses:** `204` on success, `404` if not found.

### `GET /api/links/:slug/analytics`

Returns click stats for a link.

**Response shape:**
```json
{
  "slug": "abc1234",
  "total_clicks": 42,
  "recent_clicks": [
    { "clicked_at": "2024-06-01T12:00:00.000Z", "user_agent": "curl/8.0" }
  ]
}
```

**Responses:** `200` analytics object, `404` if slug not found.

### `GET /health`

Checks API and database connectivity.

**Responses:**
- `200`: `{ "status": "ok", "db": "connected", "uptime": <seconds> }`
- `503`: `{ "status": "degraded", "db": "disconnected", "uptime": <seconds> }`

### curl examples

Base URL: `http://localhost:8080`

Examples assume a **bash** shell (macOS, Linux, or [Git Bash](https://git-scm.com/downloads) on Windows). JSON bodies use single quotes so no escaping is needed.

**Create a link (auto-generated slug):**
```bash
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -d '{"target_url":"https://example.com"}'
```

**Create a link with custom slug and expiry:**
```bash
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -d '{"target_url":"https://example.com/docs","slug":"my-docs","expires_at":"2027-01-01T00:00:00.000Z"}'
```

Run the custom-slug example before the redirect, analytics, and delete examples below.

**List all links:**
```bash
curl http://localhost:8080/api/links
```

**Follow a redirect (show response headers only):**
```bash
curl -I http://localhost:8080/my-docs
```

**Delete a link:**
```bash
curl -X DELETE http://localhost:8080/api/links/my-docs
```

**Get analytics for a slug:**
```bash
curl http://localhost:8080/api/links/my-docs/analytics
```

**Health check:**
```bash
curl http://localhost:8080/health
```

## Running tests

```bash
npm test
```

Tests use Jest and supertest against the real Express app with the database layer mocked, no PostgreSQL required in CI.

## Known limitations

- **In-memory rate limiting resets on restart** - `express-rate-limit` stores counters in process memory; there is no Redis or shared store, so limits reset when the container restarts and do not apply across multiple instances.
- **No authentication on the delete endpoint** - anyone who knows a slug can delete the link; there are no API keys or ownership checks.
- **Slug generation has no collision retry logic** - auto-generated slugs rely on nanoid entropy and the database unique constraint; a collision returns `409` rather than silently retrying with a new slug.
- **Analytics endpoint returns max 20 recent clicks** - `GET /api/links/:slug/analytics` includes `total_clicks` from the link row but only the 20 most recent `click_events` in `recent_clicks`.
