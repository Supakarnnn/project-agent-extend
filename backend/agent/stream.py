import asyncio
import json
import logging

from agent.output import public_answer, text_content


async def stream_answer(graph, messages, *, timeout=45):
    """Yield newline-delimited JSON snapshots, followed by done or error."""
    def event(kind, **data):
        return json.dumps({"type": kind, **data}, ensure_ascii=False) + "\n"

    raw = ""
    displayed = ""
    result = None
    tool_call = False
    try:
        async with asyncio.timeout(timeout):
            async for item in graph.astream_events(
                {"messages": messages, "used_tools": []},
                config={"recursion_limit": 6}, version="v2",
            ):
                kind = item["event"]
                if kind == "on_chat_model_start":
                    raw = ""
                    tool_call = False
                elif kind == "on_chat_model_stream":
                    chunk = item["data"]["chunk"]
                    tool_call = tool_call or bool(getattr(chunk, "tool_call_chunks", []))
                    raw += text_content(chunk.content)
                    answer = "" if tool_call else public_answer(raw, partial=True)
                    if answer != displayed:
                        displayed = answer
                        yield event("answer", text=answer)
                elif kind == "on_chain_end" and not item.get("parent_ids"):
                    result = item["data"]["output"]
        answer = public_answer(result["messages"][-1].content) if result else ""
        if not answer:
            yield event("error", message="Vera ยังตอบไม่สำเร็จ กรุณาลองใหม่")
            return
        yield event("done", text=answer)
    except TimeoutError:
        yield event("error", message="Vera ใช้เวลาตอบนานเกินไป กรุณาลองใหม่")
    except Exception:
        logging.getLogger("uvicorn.error").exception("Chat stream failed")
        yield event("error", message="Vera ยังไม่พร้อมใช้งาน กรุณาลองใหม่")
