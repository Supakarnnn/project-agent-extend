import os
import dotenv
import logging
import psycopg2
import time
from dataclasses import dataclass
from langchain_milvus import Milvus
from langchain_core.documents import Document
from pymilvus import MilvusClient
from agent.openrouter import EMBEDDING_DIMENSION, EMBEDDING_MODEL, openrouter_embeddings

dotenv.load_dotenv()

TEXT_FIELDS = [
    "name", "name_eng", "brand", "detail",
    "key_features", "key_ingredients",
    "suitable_for_concern", "usage_instructions", "notes",
    "category_l1", "category_l2",
]
METADATA_FIELDS = ["code", "cost", "unitname", "stock_qty", "category_l1", "category_l2", "url_image"]
COLLECTION_NAME = "materials"
VERSION_PREFIX = f"{COLLECTION_NAME}_v_"
SYNC_LOCK_ID = 724138947
logger = logging.getLogger(__name__)


class SyncAlreadyRunning(RuntimeError):
    pass


class ProductNotFound(LookupError):
    pass


@dataclass(frozen=True)
class SyncResult:
    source_count: int
    embedded_count: int
    collection_name: str
    duration_sec: float


def fetch_materials(conn, code: str | None = None) -> list[dict]:
    fields = TEXT_FIELDS + [f for f in METADATA_FIELDS if f not in TEXT_FIELDS]
    with conn.cursor() as cur:
        if code:
            cur.execute(
                f"SELECT {', '.join(fields)} FROM tbl_material WHERE is_enable = 'T' AND code = %s",
                (code,),
            )
        else:
            cur.execute(f"SELECT {', '.join(fields)} FROM tbl_material WHERE is_enable = 'T'")
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def to_document(row: dict) -> Document:
    text = "\n".join(f"{k}: {row[k]}" for k in TEXT_FIELDS if row.get(k))
    metadata = {k: (row.get(k) or "") for k in METADATA_FIELDS}
    metadata["cost"] = str(metadata["cost"])
    metadata["stock_qty"] = str(metadata["stock_qty"])
    return Document(page_content=text, metadata=metadata)


def _set_status(conn, status: str, code: str | None = None, error: str | None = None):
    where = "code = %s" if code else "is_enable = 'T'"
    with conn.cursor() as cur:
        cur.execute(
            f"""
            UPDATE tbl_material
            SET vera_sync_status = %s,
                vera_sync_error = %s,
                vera_synced_at = CASE WHEN %s = 'synced' THEN CURRENT_TIMESTAMP ELSE vera_synced_at END
            WHERE {where}
            """,
            (status, error, status, code) if code else (status, error, status),
        )
    conn.commit()


def _preflight():
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise RuntimeError("OPENROUTER_API_KEY is missing")

    embeddings = openrouter_embeddings()
    dimension = len(embeddings.embed_query("embedding dimension check"))
    if dimension != EMBEDDING_DIMENSION:
        raise RuntimeError(f"Expected {EMBEDDING_DIMENSION} embedding dimensions, got {dimension}")
    logger.info("embedding model: %s", EMBEDDING_MODEL)
    logger.info("vector dimension: %s", dimension)

    client = MilvusClient(uri=os.getenv("MILVUS_URI", "http://localhost:19530"))
    client.list_collections()
    return embeddings, client


def _collection_dimension(client: MilvusClient, collection_name: str) -> int | None:
    for field in client.describe_collection(collection_name).get("fields", []):
        if field.get("name") == "vector":
            return int(field.get("params", {}).get("dim", 0))
    return None


def _aliases(client: MilvusClient) -> list[str]:
    result = client.list_aliases()
    return result.get("aliases", []) if isinstance(result, dict) else result


def _swap_staging(client: MilvusClient, staging: str, expected_count: int):
    client.flush(staging)
    row_count = int(client.get_collection_stats(staging)["row_count"])
    if row_count != expected_count:
        raise RuntimeError(f"Staging row count mismatch: expected {expected_count}, got {row_count}")
    dimension = _collection_dimension(client, staging)
    if dimension != EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"Staging vector dimension mismatch: expected {EMBEDDING_DIMENSION}, got {dimension}"
        )
    logger.info("staging collection validated")

    previous = None
    if COLLECTION_NAME in _aliases(client):
        previous = client.describe_alias(COLLECTION_NAME)["collection_name"]
        client.alter_alias(staging, COLLECTION_NAME)
    else:
        if client.has_collection(COLLECTION_NAME):
            previous = f"{VERSION_PREFIX}legacy_{time.time_ns()}"
            client.rename_collection(COLLECTION_NAME, previous)
        try:
            client.create_alias(staging, COLLECTION_NAME)
        except Exception:
            if previous:
                client.rename_collection(previous, COLLECTION_NAME)
            raise
    logger.info("alias switched")

    for name in client.list_collections():
        if name.startswith(VERSION_PREFIX) and name not in {staging, previous}:
            try:
                client.drop_collection(name)
            except Exception as exc:
                logger.warning("could not delete old collection %s: %s", name, exc)


def _rebuild_collection(docs: list[Document], embeddings, client: MilvusClient):
    staging = f"{VERSION_PREFIX}{time.time_ns()}"
    try:
        Milvus.from_documents(
            docs,
            embeddings,
            collection_name=staging,
            connection_args={"uri": os.getenv("MILVUS_URI", "http://localhost:19530")},
        )
        logger.info("embedded: %s", len(docs))
        _swap_staging(client, staging, len(docs))
    except Exception:
        if client.has_collection(staging):
            client.drop_collection(staging)
        raise


def run(code: str | None = None) -> SyncResult:
    started = time.perf_counter()
    logger.info("sync started")
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    locked = False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_try_advisory_lock(%s)", (SYNC_LOCK_ID,))
            locked = cur.fetchone()[0]
        if not locked:
            raise SyncAlreadyRunning("A Vera sync is already running")

        embeddings, client = _preflight()
        rows = fetch_materials(conn, code)
        if code and not rows:
            raise ProductNotFound(code)
        if not rows:
            raise RuntimeError("No active products to sync")

        _set_status(conn, "syncing", code)
        logger.info("source products: %s", len(rows))
        docs = [to_document(row) for row in rows]

        if code:
            Milvus(
                embedding_function=embeddings,
                collection_name=COLLECTION_NAME,
                connection_args={"uri": os.getenv("MILVUS_URI", "http://localhost:19530")},
            ).add_documents(docs)
        else:
            _rebuild_collection(docs, embeddings, client)

        _set_status(conn, "synced", code)
        duration = time.perf_counter() - started
        logger.info("sync completed")
        logger.info("duration: %.1f sec", duration)
        return SyncResult(
            source_count=len(rows),
            embedded_count=len(docs),
            collection_name=COLLECTION_NAME,
            duration_sec=round(duration, 3),
        )
    except SyncAlreadyRunning:
        raise
    except Exception as exc:
        conn.rollback()
        if locked:
            _set_status(conn, "failed", code, str(exc)[:1000])
        raise
    finally:
        if locked:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_unlock(%s)", (SYNC_LOCK_ID,))
        conn.close()


if __name__ == "__main__":
    run()
