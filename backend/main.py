import os, dotenv, logging, time
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt
import psycopg2
import bcrypt as _bcrypt
from typing import Optional
from agent.model import llm, RequestMessage, SYSTEM_PROMPT
from agent.tools import get_current_time, search_products
import admin_sql as _sql

tools = [search_products, get_current_time]
from agent.react import react_agent
from langchain_core.messages import HumanMessage,SystemMessage,AIMessage

dotenv.load_dotenv()

_JWT_SECRET = os.environ.get("JWT_SECRET", "changeme-set-in-env")
_COOKIE = "admin_session"
_EXPIRE_HOURS = 8

app = FastAPI()
logger = logging.getLogger("uvicorn.error")


@app.middleware("http")
async def log_api_completion(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    logger.info(
        "API completed: %s %s status=%s duration_ms=%.1f",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
graph = react_agent(llm, tools=[])


class ChatRequest(BaseModel):
    message: str


class _LoginBody(BaseModel):
    name: str
    password: str


def _make_token(name: str, role: str) -> str:
    payload = {
        "sub": name,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=_EXPIRE_HOURS),
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm="HS256")


def _current_user(request: Request) -> dict:
    token = request.cookies.get(_COOKIE)
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        return jwt.decode(token, _JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid session")


@app.post("/auth/login")
def auth_login(body: _LoginBody, response: Response):
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, password, role FROM a_user WHERE name = %s AND is_active = TRUE",
                (body.name,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row or not _bcrypt.checkpw(body.password.encode(), row[1].encode()):
        raise HTTPException(401, "username or password is wrong")

    token = _make_token(row[0], row[2])
    response.set_cookie(_COOKIE, token, httponly=True, samesite="lax", max_age=_EXPIRE_HOURS * 3600)
    return {"role": row[2]}


@app.get("/auth/check")
def auth_check(user: dict = Depends(_current_user)):
    return {"name": user["sub"], "role": user["role"]}


@app.post("/auth/logout")
def auth_logout(response: Response):
    response.delete_cookie(_COOKIE, samesite="lax")
    return {"ok": True}


@app.get("/admin/metrics")
def admin_metrics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    _user: dict = Depends(_current_user),
):
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    try:
        with conn.cursor() as cur:
            params = {"start_date": start_date, "end_date": end_date}
            use_range = bool(start_date and end_date)

            cur.execute(_sql.ORDER_COMPLETION_SQL if use_range else _sql.ORDER_COMPLETION_ALL_SQL, params if use_range else None)
            order = cur.fetchone()

            cur.execute(_sql.TICKET_CREATE_SQL if use_range else _sql.TICKET_CREATE_ALL_SQL, params if use_range else None)
            handoff = cur.fetchone()

            cur.execute(_sql.AVG_AI_CON_SQL if use_range else _sql.AVG_AI_CON_ALL_SQL, params if use_range else None)
            ai = cur.fetchone()

            cur.execute(_sql.AVG_SESSION_TIME_SQL if use_range else _sql.AVG_SESSION_TIME_ALL_SQL, params if use_range else None)
            session = cur.fetchone()

            cur.execute(_sql.KEYWORD_TOPIC_SQL)
            keytop = cur.fetchone()

            cur.execute(_sql.CATALOG_SQL)
            catalog = cur.fetchone()
    finally:
        conn.close()

    return {
        "order": {
            "intent_sessions": int(order[0] or 0),
            "ai_create_order": int(order[1] or 0),
            "complete_rate": float(order[2] or 0),
        },
        "handoff": {
            "total_sessions": int(handoff[0] or 0),
            "handoff_sessions": int(handoff[1] or 0),
            "handoff_rate": float(handoff[2] or 0),
        },
        "ai": {
            "ai_message_count": int(ai[0] or 0),
            "avg_ai_confident": float(ai[1] or 0),
        },
        "session": {
            "session_used": int(session[0] or 0),
            "avg_message_count": float(session[1] or 0),
            "avg_session_duration_sec": float(session[2] or 0),
            "avg_session_duration_min": float(session[3] or 0),
        },
        "keytop": {
            "a_topic": keytop[0] if keytop else [],
            "a_key": keytop[1] if keytop else [],
        },
        "catalog": {
            "total_products": int(catalog[0] or 0),
            "low_stock": int(catalog[1] or 0),
        },
    }


class _ProductBody(BaseModel):
    name: str
    name_eng: str
    cost: float
    stock_qty: int
    brand: str = ""
    category: str = ""
    detail: str = ""


def _parse_text(text: str) -> dict:
    out = {}
    for line in text.split("\n"):
        if ": " in line:
            k, v = line.split(": ", 1)
            out[k.strip()] = v.strip()
    return out


@app.get("/admin/products")
def admin_list_products(
    page: int = 1,
    _user: dict = Depends(_current_user),
):
    PAGE_SIZE = 10
    page = max(page, 1)
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM tbl_material WHERE is_enable = 'T'")
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT code, name, name_eng, cost, stock_qty, brand, category_l1, detail
                FROM tbl_material
                WHERE is_enable = 'T'
                ORDER BY code DESC
                LIMIT %s OFFSET %s
                """,
                (PAGE_SIZE, (page - 1) * PAGE_SIZE),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    items = [
        {
            "code": r[0], "name": r[1] or "", "name_eng": r[2] or "",
            "cost": float(r[3] or 0), "stock_qty": int(r[4] or 0),
            "brand": r[5] or "", "category": r[6] or "", "detail": r[7] or "",
            "created_at": "",
        }
        for r in rows
    ]
    import math
    return {"items": items, "total": total, "page": page, "pages": math.ceil(total / PAGE_SIZE)}


@app.post("/admin/products")
def admin_add_product(body: _ProductBody, _user: dict = Depends(_current_user)):
    code = f"M{int(time.time() * 1000)}"
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tbl_material
                    (code, name, name_eng, cost, stock_qty, brand, category_l1, detail, is_enable)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'T')
                """,
                (code, body.name, body.name_eng, body.cost, body.stock_qty,
                 body.brand, body.category, body.detail),
            )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "code": code}


@app.post("/admin/products/sync")
def admin_sync_products(_user: dict = Depends(_current_user)):
    from etl import run
    return {"ok": True, "count": run()}


@app.post("/admin/products/{code}/sync")
def admin_sync_product(code: str, _user: dict = Depends(_current_user)):
    from etl import METADATA_FIELDS, TEXT_FIELDS, to_document
    from langchain_milvus import Milvus as MilvusVS
    from langchain_openai import OpenAIEmbeddings

    fields = TEXT_FIELDS + [f for f in METADATA_FIELDS if f not in TEXT_FIELDS]
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(fields)} FROM tbl_material WHERE code = %s AND is_enable = 'T'",
                (code,),
            )
            row = cur.fetchone()
            cols = [d[0] for d in cur.description]
    finally:
        conn.close()
    if not row:
        raise HTTPException(404, "Product not found")

    MilvusVS(
        embedding_function=OpenAIEmbeddings(
            model="text-embedding-3-small", api_key=os.environ.get("OPENAI_KEY")
        ),
        collection_name="materials",
        connection_args={"uri": os.getenv("MILVUS_URI", "http://localhost:19530")},
    ).add_documents([to_document(dict(zip(cols, row)))])
    return {"ok": True, "code": code}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(chatmessage: RequestMessage):
    messages = []

    for chat in chatmessage.messages:
        if chat.role == 'ai':
            messages.append(AIMessage(content=chat.content))
        elif chat.role == 'human':
            messages.append(HumanMessage(content=chat.content))
        elif chat.role == 'system':
            messages.append(SystemMessage(content=chat.content))

    agent = react_agent(llm, tools=tools, system_prompt=SYSTEM_PROMPT)
    result = await agent.ainvoke({"messages": messages, "used_tools": []})
    return {"response": result["messages"][-1].content}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
