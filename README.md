# Revive

Revive is an AI-assisted beauty and skincare product recommendation system. Customers talk to **Vera**, a Thai-speaking shopping concierge that searches the store's catalog before making product recommendations. Staff use a protected back office to manage products, synchronize the search index, and view analytics from PostgreSQL.

The frontend currently uses **Meridian** branding. The repository and backend implement the Revive product recommendation system; the landing page also contains static marketing content and sample products.

## Contents

- [What the application does](#what-the-application-does)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Database preparation](#database-preparation)
- [Run with Docker Compose](#run-with-docker-compose)
- [Run for local development](#run-for-local-development)
- [Using the application](#using-the-application)
- [API reference](#api-reference)
- [Catalog synchronization](#catalog-synchronization)
- [Development and verification](#development-and-verification)
- [Deployment considerations](#deployment-considerations)
- [Troubleshooting](#troubleshooting)
- [Current limitations](#current-limitations)
- [Contributing](#contributing)
- [License](#license)

## What the application does

### Customer concierge

- Accepts conversational questions about skincare concerns, products, ingredients, budgets, and routines.
- Uses semantic search to retrieve relevant catalog products from Milvus. The agent can refine a search when the first results are unsuitable.
- Uses supplied conversation history to keep context across requests.
- Generates Thai responses, even when the customer's question is in English. Official product and ingredient names can remain in their original language.
- Streams answers into a Markdown chat interface, with a non-streaming JSON API available for other clients.
- Filters structured reasoning blocks and supported reasoning tags from displayed output.
- Applies request validation, a per-IP request limit, and an agent timeout.

Vera is configured to give general cosmetic guidance, explain uncertainty, and avoid unsupported catalog claims. These are model instructions, not a clinical validation system. The assistant has no order, payment, reservation, refund, or staff-contact tools.

### Staff back office

- Signs staff in with credentials stored in PostgreSQL and an HTTP-only session cookie.
- Displays catalog totals, low-stock counts, order-related analytics, handoff-related analytics, AI confidence, session statistics, and the latest topic/keyword insights when the corresponding database records exist.
- Supports optional date ranges for selected dashboard metrics.
- Lists enabled products with pagination at 10 products per page.
- Searches product code, Thai name, English name, brand, and first-level category.
- Adds products to PostgreSQL and permanently deletes products by code.
- Runs a full catalog sync or a single-product sync for Vera.
- Shows synchronization status and the last successful synchronization time.

The dashboard reads existing analytics records. The current chat endpoint does not populate those records. A Chat Logs page exists, but its expected backend endpoint is not implemented. See [Current limitations](#current-limitations).

### Catalog operations

- Treats Supabase PostgreSQL as the catalog source of truth and Milvus as a derived search index.
- Generates embeddings through OpenRouter.
- Rebuilds the full index in a staging collection, validates its size and vector dimensions, and switches the `materials` alias after validation.
- Retains the previous index version during a successful full rebuild and removes older versioned collections.
- Uses a PostgreSQL advisory lock to prevent overlapping sync jobs.
- Provides an Airflow DAG for daily synchronization at **02:00 Asia/Bangkok**, with two retries separated by five minutes.

## Architecture

```mermaid
flowchart LR
    Customer[Customer browser] --> Frontend[Next.js frontend]
    Staff[Staff browser] --> Frontend
    Frontend -->|/backend-api proxy| API[FastAPI backend]
    API --> Agent[LangGraph ReAct agent]
    Agent -->|Chat completion| Router[OpenRouter]
    Agent -->|search_products| Milvus[(Milvus search index)]
    Milvus -->|Query embedding| Router
    API -->|Authentication, products, metrics| DB[(Supabase PostgreSQL)]
    API -->|Manual synchronization| ETL[Catalog ETL]
    Airflow[Airflow daily DAG] --> ETL
    ETL -->|Read products and update sync status| DB
    ETL -->|Product embeddings| Router
    ETL -->|Publish validated index| Milvus
    Attu[Attu interface] --> Milvus
```

### Chat request lifecycle

1. The browser sends the conversation as `human` and `ai` messages to `/chat`.
2. FastAPI validates the request, applies the rate limit, and converts the history to LangChain messages.
3. The LangGraph agent invokes the model with Vera's system prompt and the available tools.
4. For catalog questions, `search_products` embeds the query, searches `materials`, and returns candidate names, codes, prices, units, and stock values.
5. Tool results return to the model. The graph continues until the model produces a final answer or reaches its execution limits.
6. The backend extracts the public answer and returns JSON or newline-delimited JSON (NDJSON). The chat widget renders the result as Markdown.

The application sends catalog information and conversation content to the configured model provider. Conversation state is supplied by the client; the graph does not configure a persistent conversation checkpointer.

## Technology stack

| Area | Implementation |
| --- | --- |
| Frontend | Next.js **16.2.9**, React **19.2.4**, TypeScript |
| Styling and animation | Tailwind CSS v4, GSAP, custom CSS tokens |
| Chat rendering | `react-markdown`, browser Fetch and Streams APIs |
| Backend | FastAPI, Uvicorn, Python 3.12 in Docker |
| Agent | LangGraph **0.5.4**, LangChain, `langchain-openai` |
| Model gateway | OpenRouter's OpenAI-compatible API |
| Chat model | `qwen/qwen3.5-flash-02-23` |
| Embedding model | `baai/bge-m3`, **1,024 dimensions** |
| Vector database | Milvus standalone **2.4.17**, `langchain-milvus`, PyMilvus |
| Relational database | Supabase PostgreSQL through `psycopg2` |
| Authentication | bcrypt password checks, HS256 JWTs, HTTP-only cookies |
| Scheduling | Apache Airflow **2.10.5** |
| Vector database UI | Attu **2.4.12** |
| Local tooling | Docker Compose, npm, uv |

Model identifiers and embedding dimensions are defined in [`backend/agent/openrouter.py`](backend/agent/openrouter.py). Earlier project notes mention OpenAI models and Next.js 15; the table above reflects the current source code and package manifest.

## Repository structure

```text
revive_project/
|-- README.md
|-- docker-compose.yml          # Backend, frontend, Milvus, Attu, Airflow
|-- PRODUCT.md                  # Product planning document
|-- backend/
|   |-- main.py                 # Chat, authentication, product, and metrics APIs
|   |-- admin_sql.py            # Dashboard queries
|   |-- etl.py                  # Catalog embedding and index synchronization
|   |-- .env.example            # Backend configuration template
|   |-- requirements.docker.txt # Dependencies used by the backend image
|   |-- requirements.txt        # Broader Python dependency list
|   |-- Dockerfile
|   |-- migrations/
|   |   `-- 001_product_sync.sql
|   |-- agent/
|   |   |-- model.py            # Vera's prompt, model client, request schemas
|   |   |-- openrouter.py       # Gateway URL and model configuration
|   |   |-- react.py            # ReAct graph and tool execution
|   |   |-- tools.py            # Product search and current-time tools
|   |   |-- output.py           # Public-answer extraction
|   |   `-- stream.py           # NDJSON answer streaming
|   `-- test_*.py               # Input, output, stream, and ETL checks
|-- app/my-app/
|   |-- app/
|   |   |-- page.tsx            # Public Meridian landing page
|   |   |-- layout.tsx          # Root layout, fonts, metadata
|   |   |-- globals.css         # Theme and styles
|   |   |-- components/Chatbot.tsx
|   |   |-- lib/
|   |   |   |-- api.ts          # API base URL helper
|   |   |   `-- chat-stream.ts  # NDJSON stream reader
|   |   `-- admin/
|   |       |-- layout.tsx      # Client-side session guard
|   |       |-- page.tsx        # Analytics dashboard
|   |       |-- login/page.tsx
|   |       |-- products/page.tsx
|   |       |-- chat-logs/page.tsx
|   |       `-- _components/Shell.tsx
|   |-- public/                 # Static images and hero video
|   |-- next.config.ts          # /backend-api rewrite
|   |-- package.json
|   |-- package-lock.json
|   |-- test-chat-stream.mjs
|   `-- Dockerfile
`-- airflow/
    |-- Dockerfile
    |-- requirements.txt
    `-- dags/sync_products.py   # sync_products_to_milvus DAG
```

## Prerequisites

For the Docker workflow:

- Docker Engine or Docker Desktop with Docker Compose support. On Windows, use Linux containers.
- An OpenRouter API key with access to the configured chat and embedding models.
- A reachable PostgreSQL database with the application's existing tables and catalog data.
- Permission to apply the supplied migration and to read/write the tables used by the application.

For local development, also install:

- Python **3.12** and **uv**.
- Node.js **22** and npm, matching the frontend Docker image.
- Optionally, `psql` for applying the migration. The Supabase SQL editor is an alternative.

PostgreSQL is an external dependency. Docker Compose does not create a PostgreSQL service, seed the catalog, or provision application users. Model calls and embedding generation use the configured provider and can incur charges.

## Configuration

### Backend

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and fill in the values before starting any services. From the repository root in PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

The equivalent command in a POSIX shell is `cp backend/.env.example backend/.env`.

```dotenv
OPENROUTER_API_KEY=your-openrouter-api-key
SUPABASE_DB_URL=postgresql://db-user:db-password@db-host:5432/db-name?sslmode=require
MILVUS_URI=http://localhost:19530
JWT_SECRET=replace-with-a-long-random-secret

# Optional settings, shown with their defaults:
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CHAT_RATE_LIMIT=20
```

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Required for chat and embeddings. The current code does not use `OPENAI_KEY`. |
| `SUPABASE_DB_URL` | PostgreSQL connection string used by authentication, products, analytics, and ETL. URL-encode reserved characters in credentials. |
| `MILVUS_URI` | Milvus endpoint; defaults to `http://localhost:19530`. Compose overrides it with `http://milvus:19530` for backend and Airflow containers. |
| `JWT_SECRET` | Signing key for staff sessions. Set an explicit, nonempty random value; do not rely on the code's development fallback. |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to make cross-origin API requests with credentials. |
| `CHAT_RATE_LIMIT` | Maximum chat requests per client IP in a rolling 60-second window, within one backend process. |

Keep `.env` files out of version control. Use example files for documentation and a secret manager for deployed credentials.

### Frontend

By default, the browser calls `/backend-api`, and Next.js proxies requests to FastAPI. No frontend environment file is required for the documented local setup.

To change the proxy destination, create `app/my-app/.env.local`:

```dotenv
BACKEND_INTERNAL_URL=http://127.0.0.1:8000
```

Alternatively, set a browser-visible API URL to bypass the proxy:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_API_URL` is public configuration and must never contain secrets. Leave it unset to use the proxy. When calling FastAPI directly, configure CORS and use a consistent hostname for the frontend and backend so cookie authentication behaves as expected.

The Dockerfile sets `BACKEND_INTERNAL_URL=http://backend:8000` before building Next.js. Changes to public environment variables or the rewrite destination for a production build should be followed by a rebuild. The frontend Docker build excludes local `.env` files.

## Database preparation

The repository assumes an existing application database. It does **not** include a complete schema or seed script for creating it from scratch.

| Table | Use |
| --- | --- |
| `a_user` | Staff credentials: `name`, bcrypt-hashed `password`, `role`, and boolean `is_active`. |
| `tbl_material` | Product source data, enabled status, pricing, stock, descriptive fields, and synchronization metadata. |
| `chat_sessions` | Session intent, timestamps, message counts, and duration used by analytics. |
| `chat_messages` | Message content, tool usage, confidence, and timestamps used by analytics. |
| `message_insights` | Topic and keyword JSON data; the dashboard reads the most recent row. |

Apply [`backend/migrations/001_product_sync.sql`](backend/migrations/001_product_sync.sql) to the existing database before listing or synchronizing products. With `psql`, supply your database connection string:

```sh
psql "YOUR_POSTGRES_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f backend/migrations/001_product_sync.sql
```

You can also execute the file in the Supabase SQL editor. The migration:

- Adds creation/update timestamps and Vera synchronization fields.
- Backfills timestamps from existing `create_date` and `update_date` columns.
- Adds a unique constraint on product `code` and indexes for update time and sync status.

The migration expects `tbl_material`, `create_date`, and `update_date` to exist. Resolve duplicate product codes before adding the unique constraint. Back up existing data before applying migrations to a shared environment.

Provision staff accounts through your database administration process. Passwords must contain bcrypt hashes; authentication uses `bcrypt.checkpw()` directly. There is no registration endpoint or bundled application admin account. Airflow credentials are separate from application credentials.

## Run with Docker Compose

Run the following from the repository root after configuring `backend/.env` and preparing the database:

```sh
docker compose up -d --build
docker compose ps
```

The default Compose configuration starts all five services. Milvus must become healthy before its dependent services start, and the frontend waits for the backend health check.

| Service | Local address | Purpose |
| --- | --- | --- |
| Frontend | `http://localhost:3000` | Public page and staff back office |
| Backend | `http://localhost:8000` | FastAPI endpoints |
| Swagger UI | `http://localhost:8000/docs` | Generated, interactive API reference |
| ReDoc | `http://localhost:8000/redoc` | Generated API documentation |
| Attu | `http://localhost:8001` | Inspect Milvus collections and aliases |
| Airflow | `http://localhost:8081` | Schedule and inspect synchronization jobs |
| Milvus | `http://localhost:19530` | Vector database connection |
| Milvus health | `http://localhost:9091/healthz` | Milvus readiness endpoint |

Populate the search index before asking Vera for catalog recommendations:

```sh
docker compose exec backend python etl.py
```

Alternatively, log in at `/admin/login`, open `/admin/products`, and use the full synchronization action. Product rows in PostgreSQL do not automatically become searchable in Milvus when the application starts.

Useful operational commands:

```sh
docker compose logs -f backend
docker compose logs -f airflow
docker compose up -d --build backend frontend
docker compose down
```

`docker compose down` preserves the named `milvus_data` and `airflow_data` volumes. Removing those volumes deletes the local vector index or Airflow state; do so only when intentionally resetting the environment.

### Airflow setup

Open Airflow and enable/unpause the `sync_products_to_milvus` DAG if needed. Its schedule is `0 2 * * *` in `Asia/Bangkok`, catchup is disabled, and only one DAG run can be active at a time.

The Compose file supplies `admin` / `admin` through Airflow user environment variables. Because the service runs `airflow standalone`, check initialization logs and its generated `standalone_admin_password.txt` if those credentials do not work. Do not expose this development Airflow configuration publicly.

The DAG calls the same `etl.run()` function as the API and CLI. No separate catalog logic is maintained in Airflow.

## Run for local development

### 1. Start Milvus

From the repository root, start only the vector database and its optional UI:

```sh
docker compose up -d milvus attu
```

Wait until Milvus is healthy. These services do not provide PostgreSQL; the configured external database must still be available.

### 2. Install and start the backend

```sh
cd backend
uv venv --python 3.12
uv pip install -r requirements.docker.txt
uv run main.py
```

`requirements.docker.txt` supplies the dependencies used by the current application image. The broader `requirements.txt` also contains PDF, transformer, and other packages that are not needed for this startup workflow.

The API listens on `http://localhost:8000`. For automatic reload during development, use this command instead of `uv run main.py`:

```sh
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Run commands from `backend/` so local imports and `.env` loading use the expected project context.

### 3. Build the catalog index

In a second terminal, from `backend/`:

```sh
uv run etl.py
```

This reads enabled products and calls the embedding provider. A successful first sync is required for catalog retrieval.

### 4. Install and start the frontend

In another terminal, from the repository root:

```sh
cd app/my-app
npm ci
npm run dev
```

Open `http://localhost:3000`. The default Next.js rewrite forwards `/backend-api/*` to `http://127.0.0.1:8000/*`.

## Using the application

### Customer workflow

1. Open the public landing page and scroll to the concierge section.
2. Describe a skincare concern, desired product type, budget, or ingredient preference.
3. Answer Vera's follow-up questions when more information is needed.
4. Review candidate products and the catalog details that Vera can verify.

For example, ask: `Can you help me find a moisturizer for dry skin within a budget of 500?` Vera is instructed to respond in Thai and not to assume a currency when the data does not supply one.

Chat history is held in the page's React state. Refreshing the page starts a new browser conversation. Each request currently allows up to 20 messages; the widget does not automatically trim a longer history.

### Staff workflow

1. Visit `http://localhost:3000/admin/login` and sign in with an active database account.
2. Open the dashboard at `/admin` to inspect available metrics.
3. Open `/admin/products` to search, add, or delete catalog records.
4. Run **Update products for Vera** to publish the full current catalog to the search index, or use a single-product action when appropriate.
5. Check the displayed synchronization status and time.

Adding a product changes PostgreSQL first. Deleting a product permanently removes its PostgreSQL row, but its indexed copy remains until a full sync. Use a full sync after deletions. Repeated single-product syncs can append duplicate vectors, so use a full sync to reconcile the index.

## API reference

Paths below are FastAPI paths. Browser requests through the frontend normally prepend `/backend-api`. Interactive request schemas are also available at `/docs`.

### Public and authentication endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Returns `{"status":"ok"}`. Does not check the database or model provider. |
| `POST` | `/chat` | Runs Vera with the supplied conversation; returns JSON or NDJSON. |
| `POST` | `/auth/login` | Accepts `name` and `password`; sets `admin_session`, returns `role`. |
| `GET` | `/auth/check` | Returns the authenticated user's `name` and `role`, or HTTP 401. |
| `POST` | `/auth/logout` | Deletes the session cookie and returns `{"ok":true}`. |

### Chat request

```http
POST /chat
Content-Type: application/json
Accept: application/json
```

```json
{
  "messages": [
    {
      "role": "human",
      "content": "Help me find a moisturizer for dry skin."
    }
  ]
}
```

- Allowed roles: `human` and `ai`. Do not send `system`, `user`, or `assistant` roles to this endpoint.
- Conversation length: **1–20 messages**.
- Content length: **1–4,000 characters per message**.
- Include earlier messages to preserve conversational context.
- A successful non-streaming response is an object with a `response` string containing the public answer.

To receive a stream, set `Accept: application/x-ndjson`. Each line is an independent JSON event:

| Event | Fields | Meaning |
| --- | --- | --- |
| `answer` | `type`, `text` | Current answer snapshot. Replace the displayed answer with `text`; do not append it as a token delta. |
| `done` | `type`, `text` | Final answer; marks a successfully completed stream. |
| `error` | `type`, `message` | The stream could not complete. |

Clients must handle UTF-8 characters and JSON lines split across network chunks. The frontend implementation is in `app/my-app/app/lib/chat-stream.ts`. Some model output may be buffered until public-answer markers are available.

Non-streaming chat errors use `{"error":{"code":"...","message":"..."}}`:

| HTTP status | Code | Meaning |
| --- | --- | --- |
| `429` | `RATE_LIMITED` | Per-IP request allowance exceeded. |
| `504` | `AGENT_TIMEOUT` | Agent execution exceeded 45 seconds. |
| `503` | `AGENT_UNAVAILABLE` | Agent/provider execution failed. |
| `503` | `EMPTY_ANSWER` | No usable public answer was produced. |
| `422` | FastAPI validation response | Invalid message roles, message count, or content length. |

Once streaming response headers have been sent, execution failures are reported as `error` events inside the stream. Check the event type even when the HTTP status is successful. These stream events do not use the non-streaming error-code envelope.

### Protected staff endpoints

All endpoints below require a valid `admin_session` cookie. Browser clients must include credentials when calling across origins. The backend currently checks authentication without enforcing a specific role.

| Method | Path | Parameters or body | Result |
| --- | --- | --- | --- |
| `GET` | `/admin/metrics` | Optional `start_date`, `end_date` | `order`, `handoff`, `ai`, `session`, `keytop`, and `catalog` objects. |
| `GET` | `/admin/products` | `page` (default `1`), optional `search` | `items`, `total`, `page`, and `pages`. |
| `POST` | `/admin/products` | Product JSON | `ok` and generated product `code`. |
| `DELETE` | `/admin/products/{code}` | Product code | Permanently deletes the source row; HTTP 404 if absent. |
| `POST` | `/admin/products/sync` | No body | Full index sync and sync summary; HTTP 409 if another sync is running. |
| `POST` | `/admin/products/{code}/sync` | Product code, no body | Single-product sync; HTTP 404 if no enabled product matches, or 409 for an active sync. |

Create-product body:

```json
{
  "name": "Example moisturizer",
  "name_eng": "Example Moisturizer",
  "cost": 490,
  "stock_qty": 25,
  "brand": "Example Brand",
  "category": "Moisturizer",
  "detail": "Catalog description supplied by the store."
}
```

`name`, `name_eng`, `cost`, and `stock_qty` are required. `brand`, `category`, and `detail` default to empty strings. The backend generates the code and sets `is_enable = 'T'`; it does not embed the product during creation.

A successful sync returns `ok`, `source_count`, `embedded_count`, `collection_name`, and `duration_sec`. A single-product sync also returns `code`. Sync requests execute inline and wait for the operation to finish.

For dashboard date filtering, provide both `start_date` and `end_date` as ISO-compatible date/time values. When either is missing, the selected queries use all-time data. Topic/keyword insights and catalog totals are not filtered by this date range. Different metric queries use different session/message timestamp conditions; inspect `backend/admin_sql.py` before treating them as one reporting cohort.

## Catalog synchronization

### Source documents and metadata

ETL reads `tbl_material` rows with `is_enable = 'T'`. Each product becomes a text document built from nonempty fields:

```text
name, name_eng, brand, detail, key_features, key_ingredients,
suitable_for_concern, usage_instructions, notes, category_l1, category_l2
```

Indexed metadata includes:

```text
code, cost, unitname, stock_qty, category_l1, category_l2, url_image
```

`cost` and `stock_qty` are stored as strings in vector metadata. The Milvus adapter uses an automatically generated primary key; a product code is metadata, not the vector primary key.

Although the indexed text can contain rich product descriptions, the current search tool returns a compact name/code/price/unit/stock summary to the model. Ingredient lists and detailed usage instructions are not returned by that tool.

### Full sync

1. Acquire a PostgreSQL advisory lock shared by CLI, API, and Airflow syncs.
2. Verify embedding access, the expected 1,024-dimensional output, and Milvus connectivity.
3. Read enabled products and mark their synchronization state as `syncing`.
4. Create embeddings in a new `materials_v_*` collection.
5. Flush and validate the collection's row count and vector dimensions.
6. Switch the `materials` alias to the validated collection. A legacy physical `materials` collection is renamed during its initial migration to an alias.
7. Keep the new collection and the immediately previous version; remove older versioned collections.
8. Mark products `synced`, record their sync timestamp, and release the lock.

Failures record a `failed` status and a truncated error message where the database remains available. Validation happens before the normal alias switch, so a failed staging validation does not publish an incomplete index. The code does not provide an automatic rollback endpoint.

An empty enabled catalog is rejected; a full sync does not publish an empty index. If all source products are removed or disabled, the previous index needs explicit operational handling.

### Single-product sync

Single-product sync fetches one enabled product and appends its document to the current `materials` index. It does not delete or replace earlier vectors for the same product code. Run an initial full sync before using single-product sync, and run a full sync after deletions or when duplicate/stale vectors need reconciliation.

Changing the embedding model requires regenerating the entire index. Updating only the dimension check is insufficient: document and query embeddings must come from the same embedding configuration.

## Development and verification

### Backend checks

From `backend/`, after installing the application dependencies:

```sh
uv run --with pytest python -m pytest -q test_chat_input.py test_chat_output.py test_etl.py
uv run python test_chat_stream.py
```

These checks cover request boundaries, answer extraction, mocked ETL behavior, staging validation, concurrent-sync rejection, and streaming with fake model events. The stream script also exercises the real graph structure with a fake chat model. They do not validate a live Supabase database, Milvus deployment, or OpenRouter model response.

`test_chat_input.py` imports the configured model client, so an `OPENROUTER_API_KEY` value must be present even though this check does not make a model request. Running the streaming script directly ensures its asynchronous checks execute without requiring a pytest async plugin.

### Frontend checks

From `app/my-app/`:

```sh
node test-chat-stream.mjs
npm run lint
npx tsc --noEmit
npm run build
```

The stream check exercises Thai UTF-8 byte boundaries, final events, interrupted streams, and error events. The production build uses `next/font/google` and may require access to Google's font servers.

To serve a local production frontend after building:

```sh
npm start
```

### Manual smoke check

After starting the services and completing a full sync:

1. Open `/health` and `/docs` on the backend.
2. Ask Vera a greeting, then a catalog question; confirm that a public answer is rendered.
3. Sign in and verify that product search and pagination read PostgreSQL data.
4. In a development database, add a sample product, synchronize, and confirm it is searchable.
5. If testing deletion, delete only disposable data and run a full sync afterward.

## Deployment considerations

The supplied Compose setup is intended for development and evaluation. Review these implementation details before a shared or public deployment:

- **Session security:** set a strong `JWT_SECRET`, serve through HTTPS, and configure secure cookie handling. The current login cookie is HTTP-only and `SameSite=Lax`, expires after eight hours, and is not set with `Secure`.
- **Authorization:** protected endpoints accept any valid session. A role is stored and returned, but role-based permissions are not enforced. Add server-side authorization before separating staff privileges.
- **Account lifecycle:** the active-user check happens at login. Existing JWTs are not revalidated against the user table on each request; logout clears the browser cookie without server-side token revocation.
- **Service exposure:** restrict access to Milvus, Attu, and Airflow. The Compose file publishes their ports and does not configure Milvus authentication or TLS.
- **Airflow:** replace development credentials and the standalone deployment when introducing shared operational workloads.
- **Rate limiting:** the chat limit is process-local and keyed by the connection's client IP. Multiple workers do not share limits, and proxy routing can cause clients to share a key. Configure deliberate proxy/IP handling and shared limiting if needed.
- **Long operations:** full sync runs inside its HTTP request. Set appropriate proxy timeouts or move manual sync execution to a job system if catalogs become large.
- **Health and observability:** `/health` only confirms that the API process can answer. Add dependency readiness checks and monitoring suited to the deployment. API completion logs do not necessarily measure the full lifetime of a streamed response.
- **Data and recovery:** back up PostgreSQL and persistent volumes. The previous vector collection is retained during a successful rebuild, but restoring it is a manual operation.
- **Privacy:** review provider data handling and access controls before sending customer conversations or private catalog fields to external models.

## Troubleshooting

| Symptom | Check or action |
| --- | --- |
| Backend fails with a missing key | Set `OPENROUTER_API_KEY` in `backend/.env`; run local commands from `backend/`. The current model client does not read `OPENAI_KEY`. |
| Database connection fails | Verify the DSN, encoded credentials, SSL requirements, database availability, and network access from the host/container. |
| Product page reports missing columns | Apply `001_product_sync.sql` to the correct existing database. |
| Migration fails on old timestamp columns | Confirm the source schema contains `create_date` and `update_date`; the migration is an extension of an existing schema. |
| Migration fails on product uniqueness | Resolve duplicate `tbl_material.code` values before adding the unique constraint. |
| Vera cannot retrieve products | Verify Milvus health, provider access, and a successful initial full sync. Inspect backend logs and the `materials` alias in Attu. |
| Embedding dimension mismatch | Confirm `baai/bge-m3` returns 1,024 dimensions and perform a full rebuild after an embedding configuration change. |
| Added product is missing from recommendations | Adding a row does not update Milvus. Sync the product or run a full sync. |
| Deleted or duplicate products still appear | Run a full sync. Deletion does not remove vectors immediately, and repeated single-product syncs append vectors. |
| Sync returns HTTP 409 | Another sync holds the shared advisory lock. Wait for that run to finish and inspect backend/Airflow logs. |
| Chat returns HTTP 422 after a long conversation | The API allows at most 20 messages and 4,000 characters per message. The current widget does not trim history; reload to start a new conversation. |
| Chat returns HTTP 429 | Wait for the 60-second request window to clear; inspect `CHAT_RATE_LIMIT` and proxy client-IP behavior. |
| Chat times out or returns a stream error | Check provider/model availability, Milvus retrieval, and backend logs. Agent execution has a 45-second timeout. |
| Login does not persist | Use a consistent hostname, include credentials, and check proxy/CORS settings and the `admin_session` cookie. |
| Dashboard is empty or fails | Confirm all analytics tables and expected columns exist. The chat endpoint does not write analytics data. |
| Chat Logs page has no data | Its expected `/admin/chat-log` endpoint is absent from the backend. |
| Frontend cannot reach the API | Check `/backend-api` rewrites, `BACKEND_INTERNAL_URL`, and any `NEXT_PUBLIC_API_URL` override. Rebuild production images after build-time configuration changes. |
| Frontend build cannot download fonts | Allow the build to reach Google's font servers, or adapt the project to use locally hosted fonts. |

## Current limitations

- The landing page's product cards and marketing claims are static presentation content. They are not a live storefront tied to catalog inventory, and the repository does not implement checkout, payments, diagnostics, or a clinical document retrieval library.
- Only `search_products` and `get_current_time` are bound to the agent. Order and handoff metrics query historical `create_order` and `create_ticket` markers; these actions are not available to the current assistant.
- `/chat` does not save conversations, generate confidence scores, or write topic/keyword insights to PostgreSQL. Analytics need records supplied by another process or an extended implementation.
- `/admin/chat-logs` calls `/admin/chat-log`, which has no backend route in this repository.
- There is no complete database bootstrap, application user provisioning script, or bundled seed dataset.
- Product operations support list, search, create, delete, and sync. There is no product update endpoint.
- Role-based permissions and a separate call-center workspace are not implemented in the current routes.
- Catalog freshness depends on synchronization. Single-product sync appends vectors, full sync rejects an empty catalog, and a full rebuild is needed to reconcile deleted products.
- Chat history is browser-local and limited by the request schema. The current widget does not automatically truncate history or persist it across reloads.
- The repository contains focused regression checks, but no complete end-to-end test suite or CI workflow is included.

## Contributing

1. Create a focused branch and keep changes limited to the intended behavior.
2. Follow the applicable `AGENTS.md` instructions for the files you edit.
3. Keep credentials, database exports, generated runtime files, and local environment files out of commits.
4. Run the relevant checks described above. For database or provider changes, report which live integrations were actually verified.
5. Update this README and example configuration when routes, environment variables, models, or setup steps change.

## License

No license file is included in this repository. Confirm usage and redistribution permissions with the project owner before distributing the code.
