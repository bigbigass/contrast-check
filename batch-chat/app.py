"""batch-chat: a small chat app for the Anthropic Messages and Message Batches APIs,
or for OpenRouter (Anthropic-compatible chat + OpenRouter Batch API).

The provider is chosen from the environment: OPENROUTER_API_KEY wins if set,
otherwise ANTHROPIC_API_KEY is used.

Run with:  uvicorn app:app --port 8787
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterator, Protocol

import anthropic
import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
STATIC_DIR = HERE / "static"
OPENROUTER_BASE_URL = "https://openrouter.ai/api"

# Default model ids per provider. OpenRouter's batch doc uses plain model slugs for
# the batch-level `model` (the batch runs on that model's `:batch` endpoint variants).
DEFAULT_MODELS = {
    "anthropic": {"chat": "claude-opus-4-5", "batch": "claude-opus-4-5"},
    "openrouter": {"chat": "anthropic/claude-opus-4.5", "batch": "anthropic/claude-opus-4.5"},
}
# Batch statuses after which nothing changes any more.
TERMINAL_STATUSES = {
    "anthropic": {"ended"},
    "openrouter": {"completed", "failed", "expired", "cancelled"},
}
# Terminal statuses that come with results (OpenRouter returns `results: null` otherwise).
RESULT_STATUSES = {"anthropic": {"ended"}, "openrouter": {"completed"}}


def current_provider() -> str:
    return "openrouter" if os.environ.get("OPENROUTER_API_KEY") else "anthropic"


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
            results TEXT,                   -- JSON list, cached once the batch has ended
            provider TEXT NOT NULL DEFAULT 'anthropic',
            error TEXT                      -- JSON, batch-level error (OpenRouter)
        )"""
    )
    # Databases created before OpenRouter support lack the last two columns.
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(batches)")}
    if "provider" not in cols:
        conn.execute("ALTER TABLE batches ADD COLUMN provider TEXT NOT NULL DEFAULT 'anthropic'")
    if "error" not in cols:
        conn.execute("ALTER TABLE batches ADD COLUMN error TEXT")
    return conn


@lru_cache(maxsize=2)
def _make_client(provider: str) -> anthropic.Anthropic:
    if provider == "openrouter":
        # OpenRouter's Anthropic-compatible endpoint takes the key as a Bearer token.
        return anthropic.Anthropic(auth_token=os.environ["OPENROUTER_API_KEY"], base_url=OPENROUTER_BASE_URL)
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=api_key, base_url=os.environ.get("ANTHROPIC_BASE_URL") or None)


def get_client() -> anthropic.Anthropic:
    """Messages API client for chat (Anthropic, or OpenRouter's Anthropic-compatible endpoint)."""
    return _make_client(current_provider())


# ---------------------------------------------------------------- batch backends
#
# Both backends return batches as a dict with keys: id, status, request_counts,
# ended_at, expires_at, error, results (None, or a list of result items). A result
# item has: custom_id, type ("succeeded" | "errored" | ...), text, error, raw.


class BatchBackend(Protocol):
    name: str
    can_cancel: bool
    can_sync: bool

    def create(self, model: str, requests: list[tuple[str, dict[str, Any]]]) -> dict[str, Any]: ...
    def retrieve(self, batch_id: str) -> dict[str, Any]: ...
    def cancel(self, batch_id: str) -> dict[str, Any]: ...
    def results(self, batch_id: str) -> list[dict[str, Any]]: ...
    def list_remote(self) -> list[dict[str, Any]]: ...


def iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, timezone.utc).isoformat()
    return value.isoformat()


def api_error(e: anthropic.APIError) -> HTTPException:
    status = getattr(e, "status_code", 502)
    return HTTPException(status if 400 <= status < 600 else 502, str(e.message))


class AnthropicBatches:
    """Anthropic Message Batches API (POST /v1/messages/batches) via the SDK."""

    name = "anthropic"
    can_cancel = True
    can_sync = False

    def __init__(self, client: anthropic.Anthropic):
        self.client = client

    @staticmethod
    def _info(batch: Any) -> dict[str, Any]:
        return {
            "id": batch.id,
            "status": batch.processing_status,
            "request_counts": batch.request_counts.model_dump(mode="json"),
            "ended_at": iso(batch.ended_at),
            "expires_at": iso(batch.expires_at),
            "error": None,
            "results": None,
        }

    def create(self, model, requests):
        reqs = [{"custom_id": cid, "params": {"model": model, **body}} for cid, body in requests]
        try:
            return self._info(self.client.messages.batches.create(requests=reqs))
        except anthropic.APIError as e:
            raise api_error(e)

    def retrieve(self, batch_id):
        try:
            return self._info(self.client.messages.batches.retrieve(batch_id))
        except anthropic.APIError as e:
            raise api_error(e)

    def cancel(self, batch_id):
        try:
            return self._info(self.client.messages.batches.cancel(batch_id))
        except anthropic.APIError as e:
            raise api_error(e)

    def results(self, batch_id):
        items = []
        try:
            for r in self.client.messages.batches.results(batch_id):
                item: dict[str, Any] = {
                    "custom_id": r.custom_id,
                    "type": r.result.type,
                    "text": None,
                    "error": None,
                    "raw": r.model_dump(mode="json"),
                }
                if r.result.type == "succeeded":
                    item["text"] = "".join(b.text for b in r.result.message.content if b.type == "text")
                elif r.result.type == "errored":
                    item["error"] = r.result.error.model_dump(mode="json")
                items.append(item)
        except anthropic.APIError as e:
            raise api_error(e)
        return items

    def list_remote(self):
        raise HTTPException(400, "Sync is only available with OpenRouter")


class OpenRouterBatches:
    """OpenRouter Batch API (https://openrouter.ai/api/v1/batches); see docs/openrouter-batch-quickstart.md."""

    name = "openrouter"
    can_cancel = False  # the Batch API has no cancel endpoint
    can_sync = True
    endpoint = "/v1/messages"  # Anthropic Messages shape for every request body

    def __init__(self, http: httpx.Client):
        self.http = http

    def _call(self, method: str, path: str, **kw: Any) -> dict[str, Any]:
        try:
            r = self.http.request(method, path, **kw)
        except httpx.HTTPError as e:
            raise HTTPException(502, f"OpenRouter request failed: {e}")
        if r.status_code >= 400:
            try:
                body = r.json()
                err = body.get("error") if isinstance(body, dict) else None
                msg = err.get("message") if isinstance(err, dict) else (err or json.dumps(body))
            except ValueError:
                msg = r.text[:500]
            raise HTTPException(r.status_code if r.status_code < 600 else 502, f"OpenRouter: {msg}")
        return r.json()

    @staticmethod
    def _item(r: dict[str, Any]) -> dict[str, Any]:
        # Exactly one of `response` or `error` is populated per result.
        item: dict[str, Any] = {"custom_id": r.get("custom_id"), "type": "errored", "text": None, "error": None, "raw": r}
        resp = r.get("response")
        if resp and 200 <= resp.get("status_code", 0) < 300:
            body = resp.get("body") or {}
            item["type"] = "succeeded"
            item["text"] = "".join(
                b.get("text", "") for b in body.get("content") or [] if isinstance(b, dict) and b.get("type") == "text"
            )
        else:
            item["error"] = r.get("error") or (resp or {}).get("body")
        return item

    def _info(self, b: dict[str, Any]) -> dict[str, Any]:
        results = b.get("results")
        return {
            "id": b["id"],
            "status": b["status"],
            "request_counts": b.get("request_counts"),
            "ended_at": iso(b.get("finalized_at")),
            "expires_at": iso(b.get("expires_at")),
            "error": b.get("error"),
            "results": None if results is None else [self._item(r) for r in results],
            "model": b.get("model"),
            "created_at": b.get("created_at"),
        }

    def create(self, model, requests):
        # `endpoint` and `model` must be serialized before `requests` (the API
        # stream-parses the body). Bodies omit `model` and inherit the batch-level one.
        payload = {
            "endpoint": self.endpoint,
            "model": model,
            "requests": [{"custom_id": cid, "body": body} for cid, body in requests],
        }
        return self._info(
            self._call("POST", "/batches", content=json.dumps(payload), headers={"Content-Type": "application/json"})
        )

    def retrieve(self, batch_id):
        return self._info(self._call("GET", f"/batches/{batch_id}"))

    def cancel(self, batch_id):
        raise HTTPException(400, "OpenRouter's Batch API has no cancel endpoint")

    def results(self, batch_id):
        # Results come back inline from GET /batches/:id once the batch is completed.
        info = self.retrieve(batch_id)
        return info["results"] or []

    def list_remote(self, max_pages: int = 20):
        batches, after = [], None
        for _ in range(max_pages):
            params: dict[str, Any] = {"limit": 100}
            if after:
                params["after"] = after
            page = self._call("GET", "/batches", params=params)
            batches += [self._info(b) for b in page.get("data", [])]
            if not page.get("has_more") or not page.get("last_id"):
                break
            after = page["last_id"]
        return batches


@lru_cache(maxsize=1)
def get_openrouter_http(transport: httpx.BaseTransport | None = None) -> httpx.Client:
    return httpx.Client(
        base_url=f"{OPENROUTER_BASE_URL}/v1",
        headers={"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"},
        timeout=120,
        transport=transport,
    )


def get_batches() -> BatchBackend:
    if current_provider() == "openrouter":
        return OpenRouterBatches(get_openrouter_http())
    return AnthropicBatches(get_client())


app = FastAPI(title="batch-chat")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/config")
def config() -> dict[str, Any]:
    provider = current_provider()
    return {
        "provider": provider,
        "chat_model": DEFAULT_MODELS[provider]["chat"],
        "batch_model": DEFAULT_MODELS[provider]["batch"],
        "can_cancel": provider == "anthropic",
        "can_sync": provider == "openrouter",
    }


# ---------------------------------------------------------------- chat


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[ChatMessage] = Field(min_length=1)
    system: str | None = None
    max_tokens: int = Field(8192, ge=1)


def sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


@app.post("/api/chat")
def chat(req: ChatRequest, client: anthropic.Anthropic = Depends(get_client)) -> StreamingResponse:
    params: dict[str, Any] = {
        "model": req.model or DEFAULT_MODELS[current_provider()]["chat"],
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
    model: str | None = None
    prompts: list[str] = Field(min_length=1)
    system: str | None = None
    max_tokens: int = Field(8192, ge=1)


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["prompts"] = json.loads(d["prompts"])
    d["request_counts"] = json.loads(d["request_counts"]) if d["request_counts"] else None
    d["error"] = json.loads(d["error"]) if d["error"] else None
    d["has_results"] = d.pop("results") is not None
    d["ended"] = d["processing_status"] in TERMINAL_STATUSES.get(d["provider"], set())
    return d


def get_row(conn: sqlite3.Connection, batch_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "unknown batch")
    return row


def get_own_row(conn: sqlite3.Connection, batch_id: str, backend: BatchBackend) -> sqlite3.Row:
    row = get_row(conn, batch_id)
    if row["provider"] != backend.name:
        raise HTTPException(409, f"batch was created with {row['provider']}, but the app is running against {backend.name}")
    return row


def save_status(conn: sqlite3.Connection, info: dict[str, Any], prompts: dict[str, str] | None = None) -> None:
    conn.execute(
        "UPDATE batches SET processing_status = ?, request_counts = ?, ended_at = ?, expires_at = ?, error = ? WHERE id = ?",
        (
            info["status"],
            json.dumps(info["request_counts"]),
            info["ended_at"],
            info["expires_at"],
            json.dumps(info["error"]) if info["error"] is not None else None,
            info["id"],
        ),
    )
    if info["results"] is not None:
        cache_results(conn, info["id"], info["results"], prompts)
    conn.commit()


def cache_results(conn: sqlite3.Connection, batch_id: str, items: list[dict[str, Any]], prompts: dict[str, str] | None) -> list[dict[str, Any]]:
    if prompts is None:
        prompts = json.loads(get_row(conn, batch_id)["prompts"])
    items = [{**item, "prompt": prompts.get(item["custom_id"])} for item in items]
    # Results arrive in any order; sort by our own prompt order.
    order = {cid: i for i, cid in enumerate(prompts)}
    items.sort(key=lambda x: (order.get(x["custom_id"], len(order)), x["custom_id"] or ""))
    conn.execute("UPDATE batches SET results = ? WHERE id = ?", (json.dumps(items), batch_id))
    return items


@app.post("/api/batches")
def create_batch(req: BatchCreate, backend: BatchBackend = Depends(get_batches)) -> dict[str, Any]:
    model = req.model or DEFAULT_MODELS[backend.name]["batch"]
    prompts = {f"prompt-{i + 1}": p for i, p in enumerate(req.prompts)}
    requests = []
    for custom_id, prompt in prompts.items():
        body: dict[str, Any] = {"max_tokens": req.max_tokens, "messages": [{"role": "user", "content": prompt}]}
        if req.system:
            body["system"] = req.system
        requests.append((custom_id, body))
    info = backend.create(model, requests)

    with closing(db()) as conn:
        conn.execute(
            "INSERT INTO batches (id, created_at, model, prompts, processing_status, provider) VALUES (?, ?, ?, ?, ?, ?)",
            (info["id"], time.time(), model, json.dumps(prompts), info["status"], backend.name),
        )
        save_status(conn, info, prompts)
        return row_to_dict(get_row(conn, info["id"]))


@app.get("/api/batches")
def list_batches() -> list[dict[str, Any]]:
    with closing(db()) as conn:
        rows = conn.execute("SELECT * FROM batches ORDER BY created_at DESC").fetchall()
        return [row_to_dict(r) for r in rows]


@app.post("/api/batches/sync")
def sync_batches(backend: BatchBackend = Depends(get_batches)) -> list[dict[str, Any]]:
    """Pull the workspace's batch list from the provider (OpenRouter only): update known
    batches and add ones submitted elsewhere (their prompts are unknown here)."""
    remote = backend.list_remote()
    with closing(db()) as conn:
        for info in remote:
            exists = conn.execute("SELECT 1 FROM batches WHERE id = ?", (info["id"],)).fetchone()
            if not exists:
                conn.execute(
                    "INSERT INTO batches (id, created_at, model, prompts, processing_status, provider) VALUES (?, ?, ?, '{}', ?, ?)",
                    (info["id"], info.get("created_at") or time.time(), info.get("model") or "?", info["status"], backend.name),
                )
            save_status(conn, info)
    return list_batches()


@app.get("/api/batches/{batch_id}")
def refresh_batch(batch_id: str, backend: BatchBackend = Depends(get_batches)) -> dict[str, Any]:
    """Poll the provider for the batch's current status and store it."""
    with closing(db()) as conn:
        row = get_row(conn, batch_id)
        if not row_to_dict(row)["ended"]:
            get_own_row(conn, batch_id, backend)
            save_status(conn, backend.retrieve(batch_id))
        return row_to_dict(get_row(conn, batch_id))


@app.post("/api/batches/{batch_id}/cancel")
def cancel_batch(batch_id: str, backend: BatchBackend = Depends(get_batches)) -> dict[str, Any]:
    with closing(db()) as conn:
        get_own_row(conn, batch_id, backend)
        save_status(conn, backend.cancel(batch_id))
        return row_to_dict(get_row(conn, batch_id))


@app.delete("/api/batches/{batch_id}")
def forget_batch(batch_id: str) -> dict[str, bool]:
    """Remove the batch from the local list (does not touch the provider)."""
    with closing(db()) as conn:
        conn.execute("DELETE FROM batches WHERE id = ?", (batch_id,))
        conn.commit()
    return {"ok": True}


def load_results(batch_id: str, backend: BatchBackend) -> list[dict[str, Any]]:
    """Fetch results for an ended batch (cached in SQLite after the first fetch)."""
    with closing(db()) as conn:
        row = get_row(conn, batch_id)
        if row["results"] is not None:
            return json.loads(row["results"])
        if not row_to_dict(row)["ended"]:
            raise HTTPException(409, "batch has not ended yet")
        if row["processing_status"] in RESULT_STATUSES.get(row["provider"], set()):
            get_own_row(conn, batch_id, backend)
            items = backend.results(batch_id)
        else:
            items = []
        items = cache_results(conn, batch_id, items, None)
        conn.commit()
        return items


@app.get("/api/batches/{batch_id}/results")
def batch_results(batch_id: str, backend: BatchBackend = Depends(get_batches)) -> list[dict[str, Any]]:
    return [{k: v for k, v in r.items() if k != "raw"} for r in load_results(batch_id, backend)]


@app.get("/api/batches/{batch_id}/results.jsonl")
def batch_results_jsonl(batch_id: str, backend: BatchBackend = Depends(get_batches)) -> PlainTextResponse:
    lines = [json.dumps({"prompt": r["prompt"], **r["raw"]}) for r in load_results(batch_id, backend)]
    return PlainTextResponse(
        "\n".join(lines) + "\n",
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{batch_id}.jsonl"'},
    )
