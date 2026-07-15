# revive_project — CLAUDE.md

## Project overview

AI-powered skincare/beauty product recommendation system. Customers chat with an AI concierge ("Vera") that uses RAG to recommend products. Admins manage products and view analytics via a protected back-office.

---

## Repository layout

```
revive_project/
├── backend/              Python FastAPI backend
│   ├── main.py           All API routes (chat, auth, admin)
│   ├── admin_sql.py      Raw SQL strings for dashboard metrics
│   ├── etl.py            One-shot ETL: Supabase → Milvus embeddings
│   ├── agent/
│   │   ├── model.py      LLM instance (gpt-4o-mini), SYSTEM_PROMPT, request schemas
│   │   ├── react.py      LangGraph ReAct agent (StateGraph)
│   │   └── tools.py      @tool functions: search_products, get_current_time
│   ├── requirements.txt
│   └── .env              secrets (never commit)
├── app/my-app/           Next.js 15 frontend (App Router, Tailwind v4, TypeScript)
│   ├── app/
│   │   ├── page.tsx              Public landing/storefront with Chatbot
│   │   ├── components/Chatbot.tsx AI chat widget (calls /chat)
│   │   ├── lib/api.ts            apiUrl() helper — reads NEXT_PUBLIC_API_URL
│   │   └── admin/
│   │       ├── layout.tsx        Auth guard — calls /auth/check on every admin route
│   │       ├── login/page.tsx    Login form → POST /auth/login
│   │       ├── page.tsx          Dashboard → GET /admin/metrics
│   │       ├── products/page.tsx Product list (Milvus) + add form, paginated 10/page
│   │       ├── chat-logs/        Chat session logs
│   │       └── _components/Shell.tsx  Admin sidebar + logout
│   ├── .env.local                NEXT_PUBLIC_API_URL=http://localhost:8000
│   └── CLAUDE.md → AGENTS.md    Next.js version guidance
└── docker-compose.yml    Milvus standalone v2.4.17 (port 19530)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| LLM | OpenAI `gpt-4o-mini` via `langchain-openai` |
| Embeddings | OpenAI `text-embedding-3-small` |
| Agent | LangGraph ReAct (`StateGraph`) |
| Vector DB | Milvus standalone (Docker), collection `materials` |
| RAG client | `langchain_milvus.Milvus` |
| Backend | FastAPI + uvicorn, Python 3.12 |
| Database | Supabase (PostgreSQL), connected via `psycopg2` |
| Auth | JWT in HTTP-only cookie (`admin_session`), `PyJWT` + `bcrypt` |
| Frontend | Next.js 15, App Router, Tailwind v4, TypeScript |
| Package mgr (Python) | `uv` |

---

## Running the project

### 1. Milvus (Docker)
```bash
# from revive_project/
docker compose up -d
```

### 2. Backend
```bash
cd backend
uv run main.py
# runs on http://localhost:8000
```

### 3. ETL (load products into Milvus — run once or after Supabase data changes)
```bash
cd backend
uv run etl.py
```

### 4. Frontend
```bash
cd app/my-app
npm run dev
# runs on http://localhost:3000
```

---

## Environment variables

All secrets live in `backend/.env`. Required keys:

```
OPENAI_KEY=sk-...
SUPABASE_DB_URL=postgresql://...   # psycopg2 DSN for Supabase
MILVUS_URI=http://localhost:19530
JWT_SECRET=<random string>
```

Frontend: `app/my-app/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## API routes

### Public
| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/chat` | Chat with AI agent. Body: `{ messages: [{role, content}] }` |

### Auth (cookie-based)
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Body: `{ name, password }`. Sets `admin_session` HTTP-only cookie |
| `GET` | `/auth/check` | Returns `{ name, role }` or 401 |
| `POST` | `/auth/logout` | Clears cookie |

### Admin (requires valid cookie)
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/metrics` | Dashboard stats. Query params: `start_date`, `end_date` (optional) |
| `GET` | `/admin/products` | Products from Milvus, paginated. Query param: `page` (default 1, 10/page) |
| `POST` | `/admin/products` | Add product to Milvus with embedding |

---

## Key architecture notes

### Chat flow
1. Frontend sends full message history: `{ messages: [{role: "human"|"ai", content}] }`
2. `main.py /chat` converts to LangChain message objects and invokes `react_agent`
3. Agent calls `search_products` tool (semantic search in Milvus) to find relevant products
4. Agent responds in Thai with product recommendations

### ReAct agent (`agent/react.py`)
- Custom LangGraph `StateGraph` with two nodes: `call_model` → `call_tools`
- State: `messages: list[AnyMessage]`, `used_tools: list[str]`
- Loops back to `call_model` after tools until no more tool calls

### Milvus collection `materials`
- Loaded via `etl.py` from Supabase `tbl_material` (155 rows, `WHERE is_enable = 'T'`)
- `text` field: concatenated product text (name, name_eng, brand, detail, key_features, …)
- Metadata fields: `code`, `cost` (str), `unitname`, `stock_qty` (str), `category_l1`, `category_l2`, `url_image`
- `pk` field is **Int64** — use `expr='pk > 0'` for full-table queries

### Admin auth
- Users in Supabase table `a_user` (columns: `name`, `password`, `role`, `is_active`)
- Passwords hashed with `bcrypt` (use `bcrypt.checkpw()` directly — **not** passlib, incompatible with newer bcrypt)
- Roles: `admin` → `/admin`, `call_center` → `/admin/call`

### Frontend design tokens (`globals.css`)
```css
--bg: #0a0e0c        /* page background */
--surface: #111714   /* card/panel background */
--accent: #c2f74e    /* lime green — primary CTA, bold text in chat */
--bone: #ece6da      /* primary text */
--bone-dim: #b9b3a7  /* secondary text */
--line: #25302a      /* borders */
--moss: #38493f      /* active states, focus borders */
--muted: #79857c     /* placeholder, labels */
```

### Chat markdown rendering
Bot messages in `Chatbot.tsx` use custom `mdComponents` (no `prose` classes):
- `strong` → accent color (`var(--accent)`)
- `li` → separator border between items (`border-t border-[var(--line)]`)
- `code` → monospace with dark bg

---

## Database tables (Supabase)

Key tables referenced in `admin_sql.py`:
- `a_user` — admin users (name, password bcrypt, role, is_active)
- `tbl_material` — product catalog (source for ETL)
- `chat_sessions` — conversation sessions (active_intent, started_at, closed_at, message_count, total_duration_sec)
- `chat_messages` — individual messages (human_message, ai_message, used_tools jsonb, ai_confident, created_at)
- `message_insights` — topic/keyword analysis (topic jsonb, keywords jsonb)
