import asyncio
import json
from types import SimpleNamespace

from agent.output import public_answer
from agent.stream import stream_answer


class FakeGraph:
    async def astream_events(self, *args, **kwargs):
        yield {"event": "on_chat_model_start"}
        # Reasoning lacks an opening tag, as in the reported bug.
        raw = "private planning</think><answer>สวัสดีค่ะ</answer>"
        for char in raw:
            yield {"event": "on_chat_model_stream", "data": {
                "chunk": SimpleNamespace(content=char, tool_call_chunks=[]),
            }}
        yield {"event": "on_chain_end", "parent_ids": [], "data": {
            "output": {"messages": [SimpleNamespace(content=raw)]},
        }}


async def test_stream():
    events = [json.loads(line) async for line in stream_answer(FakeGraph(), [])]
    assert events[-1] == {"type": "done", "text": "สวัสดีค่ะ"}
    assert any(e["type"] == "answer" and e["text"] == "สวั" for e in events)
    assert all("private" not in e.get("text", "") and "<" not in e.get("text", "") for e in events)
    assert public_answer("unmarked private text", partial=True) == ""
    assert public_answer("<answer>hello<think>private", partial=True) == "hello"

    class BrokenGraph:
        async def astream_events(self, *args, **kwargs):
            raise TimeoutError()
            yield

    errors = [json.loads(line) async for line in stream_answer(BrokenGraph(), [])]
    assert len(errors) == 1 and errors[0]["type"] == "error"


async def test_real_graph():
    from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
    from langchain_core.messages import HumanMessage
    from agent.react import react_agent

    class FakeModel(GenericFakeChatModel):
        def bind_tools(self, tools):
            return self

    graph = react_agent(FakeModel(messages=iter(["<answer>สวัสดีค่ะ ยินดีช่วยค่ะ</answer>"])), [])
    events = [json.loads(line) async for line in stream_answer(graph, [HumanMessage(content="hello")])]
    assert events[-1] == {"type": "done", "text": "สวัสดีค่ะ ยินดีช่วยค่ะ"}
    assert any(e["type"] == "answer" and e["text"] == "สวัสดีค่ะ" for e in events)


if __name__ == "__main__":
    asyncio.run(test_stream())
    asyncio.run(test_real_graph())
    print("Chat streaming checks passed")
