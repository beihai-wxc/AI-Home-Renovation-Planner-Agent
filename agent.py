"""AI Home Renovation Planner - Coordinator/Dispatcher Pattern mapped to LangGraph

Pattern Reference: https://python.langchain.com/docs/langgraph/
"""

import operator
from typing import TypedDict, Annotated, List, Dict, Any, Literal, Optional
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from pydantic import BaseModel, Field

from llm_provider import get_chat_llm, get_vision_llm
from langgraph.prebuilt import ToolNode

# Tools will be imported from tools.py module
from tools import (
    baidu_search_tool,
    estimate_renovation_cost_tool,
    calculate_timeline_tool,
    generate_renovation_rendering_tool,
    edit_renovation_rendering_tool,
    list_renovation_renderings_tool,
)


# ============================================================================
# State Definition
# ============================================================================

class RenovationState(TypedDict):
    """The graph state shared by all nodes"""
    messages: Annotated[List[BaseMessage], operator.add]
    session_id: str
    user_id: str

    # Router output — written by router_node, read by conditional edge
    route_decision: str

    # Context captured from earlier steps
    room_analysis: str
    style_preferences: str
    room_type: str
    key_issues: str
    opportunities: str
    budget_constraint: str
    
    # RAG knowledge retrieval context
    rag_context: str


class RouteDecision(BaseModel):
    next_node: Literal["info", "planning", "editing"] = Field(
        ...,
        description="The target node to route to. 'info' for general chatting, 'planning' for new renovation analysis/photos, 'editing' to edit existing renderings."
    )


# ============================================================================
# Node Functions
# ============================================================================

def router_node(state: RenovationState):
    """
    Coordinator/Dispatcher (Root Agent)
    Routes user query to appropriate agent using an LLM classifier.
    Writes route_decision into state for the downstream conditional edge to read.
    """
    llm = get_chat_llm(temperature=0.0)
    structured_llm = llm.with_structured_output(RouteDecision)

    system_prompt = """You are the Coordinator for the AI Home Renovation Planner.

ROUTING LOGIC:
1. **For general questions/greetings** -> returning 'info'
2. **For editing EXISTING renderings** (e.g., "make cabinets cream") -> returning 'editing'
3. **For NEW renovation planning** (e.g., "Plan my kitchen", "Here's my space") -> returning 'planning'
   ALWAYS route here if images were uploaded in the latest message.

Output requirement:
- Return only valid structured output field `next_node`.
- Never output any extra prose.
"""
    # Look at the most recent context to decide routing.
    messages = [SystemMessage(content=system_prompt)] + state["messages"][-3:]
    try:
        decision = structured_llm.invoke(messages)
        route = decision.next_node
    except Exception:
        route = "info"  # fallback

    return {"route_decision": route}


def info_node(state: RenovationState):
    """Handles general renovation questions and provides system information"""
    llm = get_chat_llm(temperature=0.7)

    system_prompt = """You are the Info Agent for the AI Home Renovation Planner.

WHEN TO USE: The coordinator routes general questions and casual greetings to you.

YOUR RESPONSE:
- Keep it brief and helpful (2-4 sentences)
- Respond in Simplified Chinese unless the user explicitly asks for another language
- Explain the system helps with home renovations using visual AI
- Mention capabilities: photo analysis, design planning, budget estimation, timeline coordination
- Ask about their renovation project (which room, can they share photos?)
- Use Chinese user context by default: RMB, square meters, Chinese home furnishing and renovation habits

EXAMPLE:
"你好，我可以帮你分析当前房间照片和灵感图，整理出更适合落地的装修方案，包括设计建议、预算参考和周期安排。你现在想改的是哪个空间？如果方便的话，也可以直接发我房间图片。"

Be enthusiastic about home improvement and helpful!
"""
    # Inject RAG context if available
    rag_context = state.get("rag_context", "")
    if rag_context:
        system_prompt += f"\n\n=== 知识库检索结果 ===\n{rag_context}\n=====================\n根据上述知识库内容和你的判断回答用户问题。"

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}


def visual_assessor_node(state: RenovationState):
    """Analyzes room photos and inspiration images using visual AI"""
    # Use vision LLM because images might be present
    llm = get_vision_llm(temperature=0.2)
    tools = [baidu_search_tool, estimate_renovation_cost_tool]
    llm_with_tools = llm.bind_tools(tools)

    system_prompt = """You are a visual AI specialist. Analyze ANY uploaded images and detect their type automatically.

OUTPUT RULES FOR CHINESE USERS:
- Respond in Simplified Chinese unless the user explicitly asks for another language
- Prioritize Chinese home renovation context: use square meters first, RMB first, and Chinese-friendly material/furniture descriptions
- Avoid long English headings mixed into Chinese paragraphs
- Keep structure clear and concise

AUTOMATICALLY DETECT:
1. If image shows a CURRENT ROOM (existing space that needs renovation)
2. If image shows INSPIRATION/STYLE reference (desired aesthetic)
3. Extract budget constraints from user's message if mentioned

**CRITICAL - DOCUMENT EXACT LAYOUT (for preservation in rendering):**
- Window positions, Door positions, Cabinet layout, Appliance positions, Sink location, Counter layout, Camera angle

**IMPORTANT: At the end of your analysis, output a structured summary in Chinese:**
```
分析完成

Images Provided: [details]
Room Details: [Type, Analysis, Style, Key Issues, Opportunities, Budget]

**EXACT LAYOUT TO PRESERVE (critical for rendering):**
[List windows, doors, cabinets, appliances, sink exactly]
```
"""
    # Inject RAG context if available
    rag_context = state.get("rag_context", "")
    if rag_context:
        system_prompt += f"\n\n=== 知识库检索结果 ===\n{rag_context}\n=====================\n"

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


def design_planner_node(state: RenovationState):
    """Creates detailed renovation design plan"""
    llm = get_chat_llm(temperature=0.4)
    tools = [calculate_timeline_tool]
    llm_with_tools = llm.bind_tools(tools)

    system_prompt = """Create SPECIFIC, ACTIONABLE design plan tailored to their situation based on conversation history.

OUTPUT RULES FOR CHINESE USERS:
- 必须仅使用简体中文输出，除专有名词外不要输出英文句子或英文标题
- Default to RMB, square meters, and Chinese renovation vocabulary
- Avoid duplicating the same plan in multiple formats

**CRITICAL RULE - PRESERVE EXACT LAYOUT:**
The design plan must KEEP THE EXACT SAME LAYOUT as the current room. DO NOT suggest moving structure/features.
ONLY specify changes to SURFACE FINISHES.

**IMPORTANT: At the end, provide a structured summary in Chinese:**
```
设计完成

改造范围：[范围]
布局保留：完全保留

表面改造项：
[Cabinets, Walls, Countertops, etc.]

材料清单摘要: [Details]
```
"""
    # Inject RAG context if available
    rag_context = state.get("rag_context", "")
    if rag_context:
        system_prompt += f"\n\n=== 知识库检索结果 ===\n{rag_context}\n=====================\n"

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


def rendering_editor_node(state: RenovationState):
    """Edits existing renovation renderings based on user feedback"""
    llm = get_chat_llm(temperature=0.6)
    tools = [edit_renovation_rendering_tool, list_renovation_renderings_tool]
    llm_with_tools = llm.bind_tools(tools)

    system_prompt = """You refine existing renovation renderings.
**TASK**: User wants to modify an existing rendering (e.g., "make cabinets cream").

Use **edit_renovation_rendering** tool:
Parameters: artifact_filename, prompt (detailed edit instruction), asset_name

**IMPORTANT - DO NOT use markdown image syntax!**
Simply confirm the edit was successful and mention the artifact is available.

Output language rule:
- 必须仅使用简体中文回复。
"""
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


# ============================================================================
# Tool Execution Nodes
# ============================================================================

visual_assessor_tool_node = ToolNode([baidu_search_tool, estimate_renovation_cost_tool])
design_planner_tool_node = ToolNode([calculate_timeline_tool])
rendering_editor_tool_node = ToolNode([edit_renovation_rendering_tool, list_renovation_renderings_tool])


# ============================================================================
# Edge Logic
# ============================================================================

def route_after_router(state: RenovationState) -> str:
    """Conditional edge: reads route_decision from state (written by router_node)."""
    return state.get("route_decision", "info")


def should_continue_visual(state: RenovationState) -> str:
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "visual_assessor_tools"
    return "design_planner"


def should_continue_planner(state: RenovationState) -> str:
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "design_planner_tools"
    return END


def should_continue_editor(state: RenovationState) -> str:
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "rendering_editor_tools"
    return END


# ============================================================================
# Graph Compilation (Main Chatbot Graph)
# ============================================================================

checkpointer = MemorySaver()

builder = StateGraph(RenovationState)

# Nodes
builder.add_node("router", router_node)
builder.add_node("info", info_node)
builder.add_node("visual_assessor", visual_assessor_node)
builder.add_node("visual_assessor_tools", visual_assessor_tool_node)
builder.add_node("design_planner", design_planner_node)
builder.add_node("design_planner_tools", design_planner_tool_node)
builder.add_node("rendering_editor", rendering_editor_node)
builder.add_node("rendering_editor_tools", rendering_editor_tool_node)

# Edges: START -> router -> conditional
builder.add_edge(START, "router")
builder.add_conditional_edges("router", route_after_router, {
    "info": "info",
    "planning": "visual_assessor",
    "editing": "rendering_editor",
})

# Info agent stops after replying
builder.add_edge("info", END)

# Visual Assessor -> tools loop -> Design Planner
builder.add_conditional_edges("visual_assessor", should_continue_visual, {
    "visual_assessor_tools": "visual_assessor_tools",
    "design_planner": "design_planner",
})
builder.add_edge("visual_assessor_tools", "visual_assessor")

# Design Planner -> tools loop -> END
builder.add_conditional_edges("design_planner", should_continue_planner, {
    "design_planner_tools": "design_planner_tools",
    END: END,
})
builder.add_edge("design_planner_tools", "design_planner")

# Rendering Editor -> tools loop -> END
builder.add_conditional_edges("rendering_editor", should_continue_editor, {
    "rendering_editor_tools": "rendering_editor_tools",
    END: END,
})
builder.add_edge("rendering_editor_tools", "rendering_editor")

# Compile with checkpointer for cross-request memory
graph = builder.compile(checkpointer=checkpointer)


# ============================================================================
# Render Sub-Graph (Background image generation)
# ============================================================================

class RenderGraphState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    session_id: str
    user_id: str
    rag_context: str


def project_coordinator_node(state: RenderGraphState):
    llm = get_chat_llm(temperature=0.6)
    tools = [generate_renovation_rendering_tool, edit_renovation_rendering_tool, list_renovation_renderings_tool]
    llm_with_tools = llm.bind_tools(tools)

    system_prompt = """YOUR PRIMARY JOB:
Focus on generating the visual rendering as quickly as possible.
Do NOT repeat the full renovation plan, long budget sections, or long execution checklists.

If rendering succeeds, use only 2-3 sentences to summarize what the image shows.
Use generate_renovation_rendering tool and build an ULTRA-DETAILED prompt using the SLC Formula.

Output language rule:
- 最终回复必须仅使用简体中文，不得输出英文标题或英文段落。
"""
    # Inject RAG context if available
    rag_context = state.get("rag_context", "")
    if rag_context:
        system_prompt += f"\n\n=== 知识库检索结果 ===\n{rag_context}\n=====================\n"

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


render_tool_node = ToolNode([generate_renovation_rendering_tool, edit_renovation_rendering_tool, list_renovation_renderings_tool])


def should_continue_render(state: RenderGraphState) -> str:
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END


render_builder = StateGraph(RenderGraphState)
render_builder.add_node("coordinator", project_coordinator_node)
render_builder.add_node("tools", render_tool_node)

render_builder.add_edge(START, "coordinator")
render_builder.add_conditional_edges("coordinator", should_continue_render)
render_builder.add_edge("tools", "coordinator")

render_graph = render_builder.compile()

__all__ = ["graph", "render_graph"]
