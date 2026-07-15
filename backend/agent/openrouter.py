import os

import dotenv
from langchain_openai import OpenAIEmbeddings

dotenv.load_dotenv()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
CHAT_MODEL = "qwen/qwen3.5-flash-02-23"
EMBEDDING_MODEL = "baai/bge-m3"


def openrouter_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url=OPENROUTER_BASE_URL,
        check_embedding_ctx_length=False,
    )
