"""batch-chat: a small chat app for the Anthropic Messages and Message Batches APIs.

Run with:  uvicorn app:app --port 8787
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from contextlib import closing
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator

import anthropic
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
STATIC_DIR = HERE / "static"
DEFAULT_MODEL = "claude-opus-4-5"


def db_path() -> str:
    return os.environ.get("BATCH_CHAT_DB", str(HERE / "batches.db"))


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    conn.execute(
        """CREATE TABLE IF NOT EXISTS batches (
            id TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            model TEXT NOT NULL,
            prompts TEXT NOT NULL,          -- JSON {custom_id: prompt}
            processing_status TEXT NOT NULL,
            request_counts TEXT,            -- JSON
            ended_at TEXT,
            expires_at TEXT,
            results TEXT                    -- JSON list, cached once the batch has ended
        )"""
    )
    return conn


@lru_cache(maxsize=1)
def get_client() -> anthropic.Anthropic:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set")
    return anthropic.Anthropic(api_key=api_key, base_url=os.environ.get("ANTHROPIC_BASE_URL") or None)


app = FastAPI(title="batch-chat")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


# ---------------------------------------------------------------- chat


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    model: str = DEFAULT_MODEL
    messages: list[ChatMessage] = Field(min_length=1)
    system: str | None = None
    max_tokens: int = Field(8192, ge=1)


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


@app.post("/api/chat")
def chat(req: ChatRequest, client: anthropic.Anthropic = Depends(get_client)) -> StreamingResponse:
    params: dict[str, Any] = {
        "model": req.model,
        "max_tokens": req.max_tokens,
        "messages": [m.model_dump() for m in req.messages],
    }
    if req.system:
        params["system"] = req.system

    def events() -> Iterator[str]:
        try:
            with client.messages.stream(**params) as stream:
                for text in stream.text_stream:
                    yield sse({"type": "text", "text": text})
                final = stream.get_final_message()
            yield sse(
                {
                    "type": "done",
                    "stop_reason": final.stop_reason,
                    "usage": final.usage.model_dump(mode="json"),
                }
            )
        except anthropic.APIStatusError as e:
            yield sse({"type": "error", "message": e.message})
        except anthropic.APIConnectionError as e:
            yield sse({"type": "error", "message": f"connection error: {e}"})

    return StreamingResponse(events(), media_type="text/event-stream")


# ---------------------------------------------------------------- batches


class BatchCreate(BaseModel):
    model: str = DEFAULT_MODEL
    prompts: list[str] = Field(min_length=1)
    system: str | None = None
    max_tokens: int = Field(8192, ge=1)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["prompts"] = json.loads(d["prompts"])
    d["request_counts"] = json.loads(d["request_counts"]) if d["request_counts"] else None
    d["has_results"] = d.pop("results") is not None
    return d


def get_row(conn: sqlite3.Connection, batch_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "unknown batch")
    return row


def save_status(conn: sqlite3.Connection, batch: Any) -> None:
    conn.execute(
        "UPDATE batches SET processing_status = ?, request_counts = ?, ended_at = ?, expires_at = ? WHERE id = ?",
        (
            batch.processing_status,
            json.dumps(batch.request_counts.model_dump(mode="json")),
            batch.ended_at.isoformat() if batch.ended_at else None,
            batch.expires_at.isoformat() if batch.expires_at else None,
            batch.id,
        ),
    )
    conn.commit()


def api_error(e: anthropic.APIError) -> HTTPException:
    status = getattr(e, "status_code", 502)
    return HTTPException(status if 400 <= status < 600 else 502, str(e.message))


@app.post("/api/batches")
def create_batch(req: BatchCreate, client: anthropic.Anthropic = Depends(get_client)) -> dict[str, Any]:
    prompts = {f"prompt-{i + 1}": p for i, p in enumerate(req.prompts)}
    requests = []
    for custom_id, prompt in prompts.items():
        params: dict[str, Any] = {
            "model": req.model,
            "max_tokens": req.max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if req.system:
            params["system"] = req.system
        requests.append({"custom_id": custom_id, "params": params})
    try:
        batch = client.messages.batches.create(requests=requests)
    except anthropic.APIError as e:
        raise api_error(e)

    with closing(db()) as conn:
        conn.execute(
            "INSERT INTO batches (id, created_at, model, prompts, processing_status) VALUES (?, ?, ?, ?, ?)",
            (batch.id, time.time(), req.model, json.dumps(prompts), batch.processing_status),
        )
        save_status(conn, batch)
        return row_to_dict(get_row(conn, batch.id))


@app.get("/api/batches")
def list_batches() -> list[dict[str, Any]]:
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM batches ORDER BY created_at DESC").fetchall()
        return [row_to_dict(r) for r in rows]


@app.get("/api/batches/{batch_id}")
def refresh_batch(batch_id: str, client: anthropic.Anthropic = Depends(get_client)) -> dict[str, Any]:
    """Poll the API for the batch's current status and store it."""
    with closing(db()) as conn:
        row = get_row(conn, batch_id)
        if row["processing_status"] != "ended":
            try:
                save_status(conn, client.messages.batches.retrieve(batch_id))
            except anthropic.APIError as e:
                raise api_error(e)
        return row_to_dict(get_row(conn, batch_id))


@app.post("/api/batches/{batch_id}/cancel")
def cancel_batch(batch_id: str, client: anthropic.Anthropic = Depends(get_client)) -> dict[str, Any]:
    with closing(db()) as conn:
        get_row(conn, batch_id)
        try:
            save_status(conn, client.messages.batches.cancel(batch_id))
        except anthropic.APIError as e:
            raise api_error(e)
        return row_to_dict(get_row(conn, batch_id))


@app.delete("/api/batches/{batch_id}")
def forget_batch(batch_id: str) -> dict[str, bool]:
    """Remove the batch from the local list (does not touch the API)."""
    with closing(db()) as conn:
        conn.execute("DELETE FROM batches WHERE id = ?", (batch_id,))
        conn.commit()
    return {"ok": True}


def load_results(batch_id: str, client: anthropic.Anthropic) -> list[dict[str, Any]]:
    """Fetch results for an ended batch (cached in SQLite after the first fetch)."""
    with closing(db()) as conn:
        row = get_row(conn, batch_id)
        if row["results"] is not None:
            return json.loads(row["results"])
        if row["processing_status"] != "ended":
            raise HTTPException(409, "batch has not ended yet")
        prompts = json.loads(row["prompts"])
        results = []
        try:
            for r in client.messages.batches.results(batch_id):
                item: dict[str, Any] = {
                    "custom_id": r.custom_id,
                    "prompt": prompts.get(r.custom_id),
                    "type": r.result.type,
                    "text": None,
                    "error": None,
                    "raw": r.model_dump(mode="json"),
                }
                if r.result.type == "succeeded":
                    item["text"] = "".join(b.text for b in r.result.message.content if b.type == "text")
                elif r.result.type == "errored":
                    item["error"] = r.result.error.model_dump(mode="json")
                results.append(item)
        except anthropic.APIError as e:
            raise api_error(e)
        # Results arrive in any order; sort by our own prompt order.
        order = {cid: i for i, cid in enumerate(prompts)}
        results.sort(key=lambda x: order.get(x["custom_id"], len(order)))
        conn.execute("UPDATE batches SET results = ? WHERE id = ?", (json.dumps(results), batch_id))
        conn.commit()
        return results


@app.get("/api/batches/{batch_id}/results")
def batch_results(batch_id: str, client: anthropic.Anthropic = Depends(get_client)) -> list[dict[str, Any]]:
    return [{k: v for k, v in r.items() if k != "raw"} for r in load_results(batch_id, client)]


@app.get("/api/batches/{batch_id}/results.jsonl")
def batch_results_jsonl(batch_id: str, client: anthropic.Anthropic = Depends(get_client)) -> PlainTextResponse:
    lines = [json.dumps({"prompt": r["prompt"], **r["raw"]}) for r in load_results(batch_id, client)]
    return PlainTextResponse(
        "\n".join(lines) + "\n",
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{batch_id}.jsonl"'},
    )
