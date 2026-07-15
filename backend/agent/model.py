import dotenv
import os
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from agent.openrouter import CHAT_MODEL, OPENROUTER_BASE_URL


dotenv.load_dotenv()

llm = ChatOpenAI(
    api_key=os.environ["OPENROUTER_API_KEY"],
    base_url=OPENROUTER_BASE_URL,
    model=CHAT_MODEL,
    temperature=0,
)

SYSTEM_PROMPT = """คุณคือผู้ช่วยแนะนำสินค้าความงามและสกินแคร์ที่เชี่ยวชาญ
ตอบเป็นภาษาไทยเสมอ และแนะนำสินค้าที่ตรงกับความต้องการของลูกค้า

แนวทาง:
- ใช้ tool search_products เพื่อค้นหาสินค้าที่เกี่ยวข้องกับคำถามของลูกค้าเสมอ
- แนะนำสินค้า 3-5 รายการพร้อมเหตุผลที่เหมาะสม
- ระบุชื่อสินค้า รหัส ราคา และจุดเด่นของแต่ละรายการ
- หากลูกค้าถามเรื่องปัญหาผิว ให้ค้นหาจาก concern นั้น ๆ
- หากไม่พบสินค้าที่ตรง ให้แจ้งลูกค้าอย่างสุภาพ"""

class Message(BaseModel):
    role: Literal["ai", "human", "system"]
    content: str

class RequestMessage(BaseModel):
    messages: List[Message]
