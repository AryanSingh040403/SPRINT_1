from typing import Any

import requests
from langchain_core.callbacks import BaseCallbackHandler


NODE_STATUS_URL = "http://127.0.0.1:5000/api/agent-status"


class LoloStatusCallback(BaseCallbackHandler):
    """Reports real LangChain execution events to the Node backend."""

    def _send_status(
        self,
        state: str,
        message: str,
        tool: str | None = None,
    ) -> None:
        payload = {
            "state": state,
            "message": message,
            "tool": tool,
        }

        try:
            requests.post(
                NODE_STATUS_URL,
                json=payload,
                timeout=2,
            )
        except Exception:
            # Status reporting must never break the Lolo agent.
            pass

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        **kwargs: Any,
    ) -> None:
        tool_name = serialized.get(
            "name",
            "unknown_tool",
        )

        self._send_status(
            state="tool",
            message=f"Running {tool_name}",
            tool=tool_name,
        )

    def on_tool_end(
        self,
        output: Any,
        **kwargs: Any,
    ) -> None:
        self._send_status(
            state="tool_complete",
            message="Tool execution completed.",
        )

    def on_tool_error(
        self,
        error: BaseException,
        **kwargs: Any,
    ) -> None:
        self._send_status(
            state="error",
            message="Tool execution failed.",
        )

    def on_chat_model_start(
        self,
        serialized: dict[str, Any],
        messages: list[list[Any]],
        **kwargs: Any,
    ) -> None:
        self._send_status(
            state="generating",
            message="Lolo is generating a response.",
        )

    def on_retriever_start(
        self,
        serialized: dict[str, Any],
        query: str,
        **kwargs: Any,
    ) -> None:
        self._send_status(
            state="retrieving",
            message="Searching the knowledge base.",
            tool="FAISS RAG",
        )

    def on_retriever_end(
        self,
        documents: list[Any],
        **kwargs: Any,
    ) -> None:
        self._send_status(
            state="retrieval_complete",
            message=f"Retrieved {len(documents)} document(s).",
            tool="FAISS RAG",
        )