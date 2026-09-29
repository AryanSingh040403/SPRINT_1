import re
import os
import ast
import operator
from pathlib import Path
from langchain_community.tools import DuckDuckGoSearchRun
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain_classic.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import PromptTemplate
from langchain.tools import tool
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.tools import DuckDuckGoSearchRun

os.environ["OPENAI_API_KEY"] = "sk-no-key-needed"
os.environ["OPENAI_API_BASE"] = "http://localhost:8000/v1"


def get_rag_tool():
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
    )
    vector_store = FAISS.load_local(
        "../models/faiss_index_local", embeddings, allow_dangerous_deserialization=True
    )
    retriever = vector_store.as_retriever(search_kwargs={"k": 1})

    @tool
    def search_architecture_notes(query: str) -> str:
        """Search the architecture notes for facts, limits, or numbers."""
        clean_query = query.replace("query=", "").replace('"', "").replace("'", "")
        docs = retriever.invoke(clean_query)
        result = "\n\n".join([doc.page_content for doc in docs])

        # THE FIX: Removed the hardcoded math hint. Just return the clean text!
        return (
            f"\n---START OF SEARCH RESULTS---\n{result}\n---END OF SEARCH RESULTS---\n"
        )

    return search_architecture_notes


OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.BitXor: operator.xor,
    ast.USub: operator.neg,
}


def safe_eval(node):
    if isinstance(node, ast.Num):
        return node.n
    elif isinstance(node, ast.BinOp):
        return OPERATORS[type(node.op)](safe_eval(node.left), safe_eval(node.right))
    elif isinstance(node, ast.UnaryOp):
        return OPERATORS[type(node.op)](safe_eval(node.operand))
    else:
        raise TypeError(node)


@tool
def calculate_math(expression: str) -> str:
    """Evaluates a mathematical expression like '5 * 5'."""
    try:
        clean_expr = re.sub(r"[^\d\.\+\-\*\/\(\)\s]", "", str(expression))
        result = safe_eval(ast.parse(clean_expr, mode="eval").body)
        return f"Result: {result}. You have the answer. Proceed immediately to Final Answer."
    except Exception as e:
        return "Math error. Invalid input."


@tool
def get_current_time(query: str = "") -> str:
    """Returns the current date and time."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def search_live_web(query: str) -> str:
    """Use this tool to search the live internet for news, current events, or facts not in your notes."""
    try:
        print(f"🌐 [Web] Scraping DuckDuckGo for: {query}...")
        search = DuckDuckGoSearchRun()
        result = search.invoke(query)
        return f"\n---START OF WEB RESULTS---\n{result}\n---END OF WEB RESULTS---\n"
    except Exception as e:
        # THE FIX: Print the exact error to the terminal so we aren't flying blind!
        print(f"\n❌ [Web Search Error]: {str(e)}\n")
        return "Web search failed due to a server block. Tell the user the internet connection is currently down."


class QwenLLMAgent:
    def __init__(self):
        print("Initializing Llama-3.1 Stable ReAct Agent...")
        self.llm = ChatOpenAI(model="llama-3.1-8b-instruct", temperature=0.0)

        # 🌟 ADDED THE WEB SEARCH TOOL HERE
        self.tools = [get_rag_tool(), calculate_math, get_current_time, search_live_web]

        react_template = """Answer the following questions as best you can. You have access to the following tools:

{tools}

Use the following format strictly:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: your natural, conversational, and comprehensive response to the user.

CRITICAL RULES:
1. NEVER generate the word 'Question:' yourself. You are not the user.
2. CHIT-CHAT: If the user JUST makes small talk without asking a factual or mathematical question, write 'Thought: No tools needed' and reply in 'Final Answer:'.
3. RAG vs WEB: If the user asks about "our architecture", "notes", or "the project", use 'search_architecture_notes'. If they ask about real-world news, weather, or current events, use 'search_live_web'.
4. WEB SEARCH LIMIT: DuckDuckGo returns messy snippets. Do NOT loop searches. Read the snippets from your VERY FIRST search, extract the closest relevant information, and immediately proceed to 'Final Answer:'.
5. MATH CAPABILITY: If the user asks ANY math question (even if they say hello first), you MUST use 'calculate_math'. 
6. MULTI-STEP: If you need to calculate something based on a number in your notes, use 'search_architecture_notes' first, extract the number, then use 'calculate_math' on your next step.
7. TONE & COMPLETENESS: NEVER repeat the user's prompt back to them. Speak naturally like a human assistant. Answer EVERY part of their question.
8. If you have the information needed to answer the original question, your very next line MUST be 'Final Answer:'.

Begin!

Question: {input}
Thought:{agent_scratchpad}"""

        prompt = PromptTemplate.from_template(react_template)

        self.agent_executor = AgentExecutor(
            agent=create_react_agent(self.llm, self.tools, prompt),
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=5,
        )

    def generate_startup_greeting(self) -> str:
        """Generates a contextual, time-aware greeting when the agent boots up."""
        print("🧠 [Brain] Analyzing environment for greeting...")
        now = datetime.now()
        current_hour = now.hour
        time_string = now.strftime("%I:%M %p")

        if 5 <= current_hour < 12:
            time_context = "morning"
        elif 12 <= current_hour < 17:
            time_context = "afternoon"
        elif 17 <= current_hour < 22:
            time_context = "evening"
        else:
            time_context = "late at night"

        prompt = f"""You are Lolo, a highly intelligent and slightly sassy personal AI assistant. 
Your system was just booted up. 
The current time is {time_string} ({time_context}).

Write a ONE sentence greeting for your Boss. 
If it is late at night, comment on them being up late and ask what they are working on. 
If it is morning, tell them let's crush the day.
Do NOT use emojis, hashtags, or markdown. Speak naturally."""

        response = self.llm.invoke(prompt)
        return response.content

    def run(self, user_input: str, config: dict = None) -> dict:
        if config is None:
            config = {}
        strict_input = f"{user_input}\n\nCRITICAL INSTRUCTION: If asked about your architecture, chunking, or model choice, you MUST use the search_architecture_notes tool."
        return self.agent_executor.invoke({"input": strict_input}, config=config)


if __name__ == "__main__":
    agent = QwenLLMAgent()
    print("\n--- 🌅 STARTUP GREETING TEST ---")
    print(agent.generate_startup_greeting())
