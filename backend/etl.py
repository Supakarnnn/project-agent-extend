import os
import dotenv
import psycopg2
from langchain_openai import OpenAIEmbeddings
from langchain_milvus import Milvus
from langchain_core.documents import Document

dotenv.load_dotenv()

TEXT_FIELDS = [
    "name", "name_eng", "brand", "detail",
    "key_features", "key_ingredients",
    "suitable_for_concern", "usage_instructions", "notes",
    "category_l1", "category_l2",
]
METADATA_FIELDS = ["code", "cost", "unitname", "stock_qty", "category_l1", "category_l2", "url_image"]


def fetch_materials() -> list[dict]:
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor()
    cur.execute(f"""
        SELECT {", ".join(TEXT_FIELDS + [f for f in METADATA_FIELDS if f not in TEXT_FIELDS])}
        FROM tbl_material
        WHERE is_enable = 'T'
    """)
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, row)) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def to_document(row: dict) -> Document:
    text = "\n".join(f"{k}: {row[k]}" for k in TEXT_FIELDS if row.get(k))
    metadata = {k: (row.get(k) or "") for k in METADATA_FIELDS}
    metadata["cost"] = str(metadata["cost"])
    metadata["stock_qty"] = str(metadata["stock_qty"])
    return Document(page_content=text, metadata=metadata)


def run():
    rows = fetch_materials()
    print(f"Fetched {len(rows)} rows from Supabase")

    docs = [to_document(r) for r in rows]
    embeddings = OpenAIEmbeddings(
        model="text-embedding-3-small", api_key=os.environ.get("OPENAI_KEY")
    )

    Milvus.from_documents(
        docs,
        embeddings,
        collection_name="materials",
        connection_args={"uri": os.getenv("MILVUS_URI", "http://localhost:19530")},
        drop_old=True,
    )
    print(f"Inserted {len(docs)} documents into Milvus collection 'materials'")
    return len(docs)


if __name__ == "__main__":
    run()
