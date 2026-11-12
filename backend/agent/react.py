from langgraph.graph import StateGraph  
from langchain_core.messages import  SystemMessage, ToolMessage , AnyMessage, HumanMessage
from langchain_openai import ChatOpenAI
from typing import TypedDict, List, Literal

class ReactState(TypedDict):
    messages: list[AnyMessage]
    used_tools: list[str]
    
def react_agent(llm : ChatOpenAI , tools : list, system_prompt : str | None = None):
    model_with_tools = llm.bind_tools(tools)

    async def call_tools(state: ReactState):
        tools_by_name = {tool.name: tool for tool in tools}
        messages = []
        used_tools: List[str] = state.get("used_tools", [])
        for tool_call in state["messages"][-1].tool_calls:
            name = tool_call["name"]
            tool = tools_by_name.get(name)
            if tool is None:
                result = f"Tool '{name}' is not available"
            else:
                try:
                    result = await tool.ainvoke(tool_call["args"])
                    used_tools.append(name)
                except Exception:
                    result = f"Tool '{name}' failed. Do not invent results."

            messages.append(ToolMessage(
                content=result,
                tool_call_id=tool_call["id"],
                name=name
            ))
        return {"messages": state["messages"] + messages,
                "used_tools": used_tools,
                }

    def should_continue(state: ReactState) -> Literal["tools", "__end__"]:
        messages = state["messages"]
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return "__end__"

    async def call_model(state: ReactState):
        messages = state["messages"]
        used_tools: List[str] = state.get("used_tools", [])
        if system_prompt: 
            message = await model_with_tools.ainvoke([SystemMessage(content=system_prompt) , *messages]) 
        else:
            message = await model_with_tools.ainvoke(messages) 
        return {
        "messages": messages + [message],
        "used_tools": used_tools,
        }

    builder = StateGraph(ReactState)
    builder.add_node("call_model", call_model)
    builder.add_node("tools", call_tools)
    builder.add_edge("__start__", "call_model")
    builder.add_conditional_edges(
        "call_model",
        should_continue
    )
    builder.add_edge("tools", "call_model") 
    graph = builder.compile()
    return graph
