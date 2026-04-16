CREATE TABLE IF NOT EXISTS outbox_messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    mime_message_json TEXT NOT NULL,
    status TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    queued_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_account_status ON outbox_messages(account_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_queued_at ON outbox_messages(account_id, queued_at ASC);
