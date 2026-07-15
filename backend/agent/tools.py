import os
from langchain_core.tools import tool
from langchain_milvus import Milvus
from datetime import datetime
from agent.openrouter import openrouter_embeddings


def _get_vectorstore() -> Milvus:
    return Milvus(
        embedding_function=openrouter_embeddings(),
        collection_name="materials",
        connection_args={"uri": os.getenv("MILVUS_URI", "http://localhost:19530")},
    )


@tool
def search_products(query: str, k: int = 5) -> str:
    """Search for products by semantic similarity. Use this when the user asks about products, ingredients, or skincare concerns.

    Args:
        query: Natural language query describing what the user is looking for.
        k: Number of products to return (default 5).
    """
    docs = _get_vectorstore().similarity_search(query, k=k)
    if not docs:
        return "ไม่พบสินค้าที่เกี่ยวข้อง"

    results = []
    for doc in docs:
        m = doc.metadata
        results.append(
            f"- [{m.get('code')}] {doc.page_content.split(chr(10))[0]}"
            f" | หน่วย: {m.get('unitname')} | ราคา: {m.get('cost')} | stock: {m.get('stock_qty')}"
        )
    return "\n".join(results)


@tool
def get_current_time() -> str:
    """Returns the current date and time."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
