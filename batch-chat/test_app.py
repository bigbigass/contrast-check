"""Minimal tests with a fake Anthropic client (no network, no API key needed).

Run with:  pytest
"""

from datetime import datetime, timezone
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient

import app as app_module


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
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("BATCH_CHAT_DB", str(tmp_path / "test.db"))
    fake = FakeClient()
    app_module.app.dependency_overrides[app_module.get_client] = lambda: fake
    yield TestClient(app_module.app), fake
    app_module.app.dependency_overrides.clear()


def test_index(client):
    c, _ = client
    assert "batch-chat" in c.get("/").text


def test_chat_streams_sse(client):
    c, _ = client
    r = c.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200
    assert '"text": "Hel"' in r.text and '"type": "done"' in r.text


def test_batch_lifecycle(client):
    c, fake = client
    b = c.post("/api/batches", json={"model": "claude-opus-4-5", "prompts": ["1+1?", "2+2?"]}).json()
    assert b["id"] == "msgbatch_1" and b["processing_status"] == "in_progress"
    assert [r["custom_id"] for r in fake.messages.batches.created] == ["prompt-1", "prompt-2"]
    assert len(c.get("/api/batches").json()) == 1

    assert c.get("/api/batches/msgbatch_1/results").status_code == 409

    fake.messages.batches.status = "ended"
    assert c.get("/api/batches/msgbatch_1").json()["processing_status"] == "ended"

    results = c.get("/api/batches/msgbatch_1/results").json()
    assert [(r["prompt"], r["text"]) for r in results] == [("1+1?", "two"), ("2+2?", "four")]
    jsonl = c.get("/api/batches/msgbatch_1/results.jsonl")
    assert jsonl.status_code == 200 and len(jsonl.text.strip().splitlines()) == 2

    c.delete("/api/batches/msgbatch_1")
    assert c.get("/api/batches").json() == []
