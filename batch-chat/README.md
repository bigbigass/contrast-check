# batch-chat

A small self-contained chat app for the Anthropic API. It's a Python/FastAPI backend with a single static HTML/JS page and no build step.

- **Chat**: streams replies from the Messages API. You type the model name in a text box (default `claude-opus-4-5`). Max tokens and a system prompt are optional. Conversations are kept in the browser's `localStorage`.
- **Batch**: queue several prompts and submit them as one Message Batch (`POST /v1/messages/batches`, 50% of standard price). The page polls each pending batch's status every 15 seconds. Once a batch has ended you can view its results or download them as JSONL. The batch list is stored in a local SQLite file (`batches.db`), and results are cached there after the first fetch.

The app is not meant to be exposed beyond localhost: it has no auth, and every request uses your API key.

## Run

```bash
cd batch-chat
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
# optional: export ANTHROPIC_BASE_URL=https://your-proxy.example.com
uvicorn app:app --port 8787
```

Open http://localhost:8787.

Other environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | (required) | API key |
| `ANTHROPIC_BASE_URL` | Anthropic API | Alternative API base URL |
| `BATCH_CHAT_DB` | `./batches.db` | Path of the SQLite file holding the batch list |

## Test

```bash
pytest
```

The tests use a fake client, so they don't need a key or network access.

## API

| Method & path | Description |
|---|---|
| `POST /api/chat` | `{model, messages, system?, max_tokens?}` → server-sent events: `{"type":"text"}` chunks, then `done` or `error` |
| `POST /api/batches` | `{model, prompts[], system?, max_tokens?}` → creates the batch; each prompt gets `custom_id` `prompt-N` |
| `GET /api/batches` | Local batch list |
| `GET /api/batches/{id}` | Fetches the current status from the API and stores it |
| `POST /api/batches/{id}/cancel` | Cancels the batch |
| `DELETE /api/batches/{id}` | Removes the batch from the local list only |
| `GET /api/batches/{id}/results` | Results in prompt order (409 until the batch has ended) |
| `GET /api/batches/{id}/results.jsonl` | Raw results as a JSONL download, each line with its prompt |
