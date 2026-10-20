# batch-chat

A small self-contained chat app for Claude, through either the Anthropic API or OpenRouter. It's a Python/FastAPI backend with a single static HTML/JS page and no build step.

- **Chat**: streams replies through the Anthropic Messages API, or through OpenRouter's Anthropic-compatible endpoint. You type the model id in a text box. Max tokens and a system prompt are optional. Conversations are kept in the browser's `localStorage`.
- **Batch**: queue several prompts and submit them as one batch, which is typically half the standard price. The page polls each pending batch's status every 15 seconds. Once a batch has finished you can view its results or download them as JSONL. The batch list is stored in a local SQLite file (`batches.db`), and results are cached there after the first fetch.

The app is not meant to be exposed beyond localhost: it has no auth, and every request uses your API key.

## Providers

The environment decides which provider the app uses:

| Provider | Selected when | Chat | Batch | Default model |
|---|---|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` is set (takes precedence) | Anthropic-compatible endpoint, `https://openrouter.ai/api/v1/messages` (Bearer auth) | OpenRouter Batch API, `https://openrouter.ai/api/v1/batches`, with `endpoint: "/v1/messages"` | `anthropic/claude-opus-4.5` |
| Anthropic | otherwise, using `ANTHROPIC_API_KEY` | Messages API | Message Batches API, `POST /v1/messages/batches` | `claude-opus-4-5` |

The page shows which provider is active and remembers model ids separately for each provider. Batches are tagged with the provider that created them. A batch created under the other provider stays in the list but can't be polled until you switch back to its key.

### OpenRouter batch notes

The OpenRouter support follows [`docs/openrouter-batch-quickstart.md`](docs/openrouter-batch-quickstart.md):

- **Submit:** the request has `endpoint`, then `model`, then `requests: [{custom_id, body}]`, in that order because the API reads the body as a stream. Each `body` is Anthropic Messages-shaped (`max_tokens`, `messages`, optional `system`). Bodies leave out `model`, so they inherit the batch-level model.
- **Model id:** the doc passes a plain model slug (e.g. `anthropic/claude-opus-4.5`) and runs the batch on that model's `:batch` endpoint variant. You can type any id in the **Batch model** field. Which models have a batch variant is listed at https://openrouter.ai/models?variant=batch. OpenRouter returns 400 for a model without one.
- **Polling:** each batch is polled with `GET /api/v1/batches/:id`. Its statuses are `validating`, `in_progress`, `finalizing` and `completed`; `failed`, `expired`, `cancelling` and `cancelled` can also occur. The terminal ones are `completed`, `failed`, `expired` and `cancelled`.
- **Results:** they come back inline in that same `GET` once the batch is `completed`, and the app caches them straight away. Each result has either a `response` (with `status_code` and a Messages `body`) or an `error`. A failed batch shows its batch-level `error` in the list.
- **Sync from OpenRouter:** this button pages through `GET /api/v1/batches` (`limit`/`after`/`has_more`). It updates batches you already have and adds ones submitted elsewhere in the workspace. Their prompts aren't known here, so results show only `custom_id`.
- **No cancel:** OpenRouter's Batch API has no cancel endpoint, so there's no Cancel button. Its `DELETE` endpoint permanently purges a finished batch upstream. The app doesn't call it; **Forget** only removes the batch from the local list.
- **Retention:** OpenRouter deletes results 30 days after a batch is created, but results already cached in `batches.db` are kept.

## Run

```bash
cd batch-chat
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# either OpenRouter …
export OPENROUTER_API_KEY=sk-or-...
# … or Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
# optional: export ANTHROPIC_BASE_URL=https://your-proxy.example.com   (Anthropic provider only)

uvicorn app:app --port 8787
```

Open http://localhost:8787.

Other environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | (unset) | Selects OpenRouter |
| `ANTHROPIC_API_KEY` | (unset) | Selects Anthropic, when no OpenRouter key is set |
| `ANTHROPIC_BASE_URL` | Anthropic API | Alternative API base URL (Anthropic provider only) |
| `BATCH_CHAT_DB` | `./batches.db` | Path of the SQLite file holding the batch list |

## Test

```bash
pytest
```

The tests don't need a key or network access. Anthropic calls go through a fake SDK client, and OpenRouter calls go through mocked HTTP (`httpx.MockTransport`) that returns responses shaped like the doc.

## API

| Method & path | Description |
|---|---|
| `GET /api/config` | Active provider, default models, and whether cancel and sync are available |
| `POST /api/chat` | `{model?, messages, system?, max_tokens?}` → server-sent events: `{"type":"text"}` chunks, then `done` or `error` |
| `POST /api/batches` | `{model?, prompts[], system?, max_tokens?}` → creates the batch; each prompt gets `custom_id` `prompt-N` |
| `GET /api/batches` | Local batch list (each entry includes `provider` and `ended`) |
| `POST /api/batches/sync` | OpenRouter only: pulls the workspace's batch list into the local list |
| `GET /api/batches/{id}` | Fetches the current status from the provider and stores it |
| `POST /api/batches/{id}/cancel` | Anthropic only: cancels the batch |
| `DELETE /api/batches/{id}` | Removes the batch from the local list only |
| `GET /api/batches/{id}/results` | Results in prompt order (409 until the batch has finished) |
| `GET /api/batches/{id}/results.jsonl` | Raw results as a JSONL download, each line with its prompt |
