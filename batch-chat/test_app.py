"""Minimal tests with mocked providers (no network, no API key needed).

Run with:  pytest
"""

import json
from datetime import datetime, timezone
from types import SimpleNamespace as NS

import httpx
import httpx2
import pytest
from fastapi.testclient import TestClient

import app as app_module


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("BATCH_CHAT_DB", str(tmp_path / "test.db"))
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    yield
    app_module.app.dependency_overrides.clear()


# ---------------------------------------------------------------- Anthropic (fake SDK client)


class Dumpable(NS):
    def model_dump(self, mode="python"):
        return {k: v for k, v in vars(self).items() if isinstance(v, (str, int, float, type(None)))}


class FakeStream:
    text_stream = ["Hel", "lo"]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def get_final_message(self):
        return NS(stop_reason="end_turn", usage=Dumpable(input_tokens=3, output_tokens=2))


class FakeBatches:
    def __init__(self):
        self.created = None
        self.status = "in_progress"

    def _batch(self):
        ended = self.status == "ended"
        return NS(
            id="msgbatch_1",
            processing_status=self.status,
            request_counts=Dumpable(processing=0 if ended else 2, succeeded=2 if ended else 0, errored=0, canceled=0, expired=0),
            ended_at=datetime.now(timezone.utc) if ended else None,
            expires_at=None,
        )

    def create(self, requests):
        self.created = requests
        return self._batch()

    def retrieve(self, batch_id):
        return self._batch()

    def results(self, batch_id):
        # Out of order on purpose: the app must re-sort by custom_id.
        for cid, text in [("prompt-2", "four"), ("prompt-1", "two")]:
            msg = NS(content=[NS(type="text", text=text)])
            yield Dumpable(custom_id=cid, result=NS(type="succeeded", message=msg))


class FakeClient:
    def __init__(self):
        self.messages = NS(stream=lambda **kw: FakeStream(), batches=FakeBatches())


@pytest.fixture
def anthropic_app():
    fake = FakeClient()
    app_module.app.dependency_overrides[app_module.get_client] = lambda: fake
    app_module.app.dependency_overrides[app_module.get_batches] = lambda: app_module.AnthropicBatches(fake)
    return TestClient(app_module.app), fake


def test_index(anthropic_app):
    c, _ = anthropic_app
    assert "batch-chat" in c.get("/").text
    assert c.get("/api/config").json()["provider"] == "anthropic"


def test_chat_streams_sse(anthropic_app):
    c, _ = anthropic_app
    r = c.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200
    assert '"text": "Hel"' in r.text and '"type": "done"' in r.text


def test_anthropic_batch_lifecycle(anthropic_app):
    c, fake = anthropic_app
    b = c.post("/api/batches", json={"model": "claude-opus-4-5", "prompts": ["1+1?", "2+2?"]}).json()
    assert b["id"] == "msgbatch_1" and b["processing_status"] == "in_progress" and not b["ended"]
    assert [r["custom_id"] for r in fake.messages.batches.created] == ["prompt-1", "prompt-2"]
    assert fake.messages.batches.created[0]["params"]["model"] == "claude-opus-4-5"
    assert len(c.get("/api/batches").json()) == 1

    assert c.get("/api/batches/msgbatch_1/results").status_code == 409

    fake.messages.batches.status = "ended"
    assert c.get("/api/batches/msgbatch_1").json()["ended"]

    results = c.get("/api/batches/msgbatch_1/results").json()
    assert [(r["prompt"], r["text"]) for r in results] == [("1+1?", "two"), ("2+2?", "four")]
    jsonl = c.get("/api/batches/msgbatch_1/results.jsonl")
    assert jsonl.status_code == 200 and len(jsonl.text.strip().splitlines()) == 2

    c.delete("/api/batches/msgbatch_1")
    assert c.get("/api/batches").json() == []


# ---------------------------------------------------------------- OpenRouter (mocked HTTP)


def sse_body(text):
    events = [
        ("message_start", {"type": "message_start", "message": {
            "id": "msg_1", "type": "message", "role": "assistant", "model": "anthropic/claude-opus-4.5", "content": [],
            "stop_reason": None, "stop_sequence": None, "usage": {"input_tokens": 3, "output_tokens": 0}}}),
        ("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None}, "usage": {"output_tokens": 2}}),
        ("message_stop", {"type": "message_stop"}),
    ]
    return "".join(f"event: {e}\ndata: {json.dumps(d)}\n\n" for e, d in events)


def test_openrouter_chat_uses_anthropic_compatible_endpoint(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-test")  # ANTHROPIC_API_KEY is also set and must not leak
    seen = {}

    def handler(req):
        seen.update(url=str(req.url), headers=dict(req.headers), body=json.loads(req.content))
        return httpx2.Response(200, text=sse_body("Hi from OR"), headers={"content-type": "text/event-stream"})

    client = app_module._make_client.__wrapped__("openrouter").copy(
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler))
    )
    app_module.app.dependency_overrides[app_module.get_client] = lambda: client
    c = TestClient(app_module.app)

    assert c.get("/api/config").json()["chat_model"] == "anthropic/claude-opus-4.5"
    r = c.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert '"text": "Hi from OR"' in r.text and '"type": "done"' in r.text
    assert seen["url"] == "https://openrouter.ai/api/v1/messages"
    assert seen["headers"]["authorization"] == "Bearer or-test"
    assert "x-api-key" not in seen["headers"]
    assert seen["body"]["model"] == "anthropic/claude-opus-4.5" and seen["body"]["stream"] is True


class FakeOpenRouter:
    """In-memory stand-in for https://openrouter.ai/api/v1/batches, shaped per docs/openrouter-batch-quickstart.md."""

    def __init__(self):
        self.batches = {}
        self.submitted = None
        self.requests = []

    def batch(self, bid, status, results=None, **extra):
        done = status == "completed"
        return {
            "id": bid, "object": "batch", "endpoint": "/v1/messages", "model": "anthropic/claude-opus-4.5",
            "completion_window": "24h", "status": status, "created_at": 1782097200,
            "finalized_at": 1782100800 if done else None, "provider": "Anthropic", "expires_at": 1782183600,
            "request_counts": {"total": 2, "completed": 1 if done else 0, "failed": 1 if done else 0},
            "usage": None, "results": results if done else None, "error": None, **extra,
        }

    def __call__(self, req: httpx.Request) -> httpx.Response:
        self.requests.append(req)
        assert req.headers["authorization"] == "Bearer or-test"
        path = req.url.path
        if req.method == "POST" and path == "/api/v1/batches":
            self.submitted = json.loads(req.content)
            self.batches["batch_123"] = self.batch("batch_123", "validating")
            return httpx.Response(202, json=self.batches["batch_123"])
        if req.method == "GET" and path == "/api/v1/batches":
            after = req.url.params.get("after")
            if after is None:
                return httpx.Response(200, json={"object": "list", "data": [self.batches["batch_123"]],
                                                 "first_id": "batch_123", "last_id": "batch_123", "has_more": True})
            assert after == "batch_123"
            other = self.batch("batch_old", "failed", error={"message": "bad request line"})
            return httpx.Response(200, json={"object": "list", "data": [other],
                                             "first_id": "batch_old", "last_id": "batch_old", "has_more": False})
        if req.method == "GET" and path.startswith("/api/v1/batches/"):
            bid = path.rsplit("/", 1)[1]
            if bid not in self.batches:
                return httpx.Response(404, json={"error": {"message": "Batch not found"}})
            return httpx.Response(200, json=self.batches[bid])
        return httpx.Response(404, json={"error": {"message": f"no route {req.method} {path}"}})


@pytest.fixture
def openrouter_app(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-test")
    fake = FakeOpenRouter()
    http = app_module.get_openrouter_http.__wrapped__(transport=httpx.MockTransport(fake))
    app_module.app.dependency_overrides[app_module.get_batches] = lambda: app_module.OpenRouterBatches(http)
    return TestClient(app_module.app), fake


def test_openrouter_batch_lifecycle(openrouter_app):
    c, fake = openrouter_app
    cfg = c.get("/api/config").json()
    assert cfg["provider"] == "openrouter" and not cfg["can_cancel"] and cfg["can_sync"]

    b = c.post("/api/batches", json={"prompts": ["1+1?", "2+2?"], "system": "be brief", "max_tokens": 64}).json()
    assert b["id"] == "batch_123" and b["processing_status"] == "validating" and b["provider"] == "openrouter"
    # endpoint/model must precede requests; bodies are Messages-shaped and inherit the batch model.
    assert list(fake.submitted) == ["endpoint", "model", "requests"]
    assert fake.submitted["endpoint"] == "/v1/messages"
    assert fake.submitted["model"] == "anthropic/claude-opus-4.5"
    assert fake.submitted["requests"][0] == {
        "custom_id": "prompt-1",
        "body": {"max_tokens": 64, "messages": [{"role": "user", "content": "1+1?"}], "system": "be brief"},
    }

    assert c.post("/api/batches/batch_123/cancel").status_code == 400
    assert c.get("/api/batches/batch_123/results").status_code == 409

    fake.batches["batch_123"] = fake.batch("batch_123", "in_progress")
    assert not c.get("/api/batches/batch_123").json()["ended"]

    fake.batches["batch_123"] = fake.batch("batch_123", "completed", results=[
        {"id": "batch_req_2", "custom_id": "prompt-2", "response": None,
         "error": {"code": "invalid_request", "message": "nope"}},
        {"id": "batch_req_1", "custom_id": "prompt-1", "error": None, "response": {
            "status_code": 200, "request_id": "request_1", "body": {
                "id": "gen-batch-1", "type": "message", "role": "assistant", "model": "anthropic/claude-opus-4.5",
                "content": [{"type": "text", "text": "two"}], "stop_reason": "end_turn"}}},
    ])
    refreshed = c.get("/api/batches/batch_123").json()
    assert refreshed["ended"] and refreshed["has_results"]  # cached straight from the poll response
    assert refreshed["request_counts"] == {"total": 2, "completed": 1, "failed": 1}

    n = len(fake.requests)
    results = c.get("/api/batches/batch_123/results").json()
    assert len(fake.requests) == n  # served from the SQLite cache
    assert [(r["custom_id"], r["prompt"], r["type"], r["text"]) for r in results] == [
        ("prompt-1", "1+1?", "succeeded", "two"),
        ("prompt-2", "2+2?", "errored", None),
    ]
    assert results[1]["error"]["message"] == "nope"
    lines = c.get("/api/batches/batch_123/results.jsonl").text.strip().splitlines()
    assert json.loads(lines[0])["response"]["body"]["id"] == "gen-batch-1"


def test_openrouter_sync_pages_through_list(openrouter_app):
    c, fake = openrouter_app
    c.post("/api/batches", json={"prompts": ["hi"]})
    batches = {b["id"]: b for b in c.post("/api/batches/sync").json()}
    assert set(batches) == {"batch_123", "batch_old"}
    assert batches["batch_old"]["ended"] and batches["batch_old"]["error"] == {"message": "bad request line"}
    assert c.get("/api/batches/batch_old/results").json() == []


def test_openrouter_errors_are_passed_through(openrouter_app):
    c, _ = openrouter_app
    with app_module.closing(app_module.db()) as conn:
        conn.execute("INSERT INTO batches (id, created_at, model, prompts, processing_status, provider) "
                     "VALUES ('batch_gone', 0, 'm', '{}', 'in_progress', 'openrouter')")
        conn.commit()
    r = c.get("/api/batches/batch_gone")
    assert r.status_code == 404 and "Batch not found" in r.json()["detail"]
