use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rusqlite::{params, types::Type, OptionalExtension, Row};

use crate::{
    domain::{
        errors::DomainError,
        models::outbox::{OutboxMessage, OutboxStatus},
        repositories::OutboxRepository,
    },
    infrastructure::{database::Database, sync::MimeMessage},
};

#[derive(Clone)]
pub struct SqliteOutboxRepository {
    db: Database,
}

impl SqliteOutboxRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }
}

#[async_trait]
impl OutboxRepository for SqliteOutboxRepository {
    async fn find_by_id(&self, id: &str) -> Result<Option<OutboxMessage>, DomainError> {
        let connection = self.db.connection()?;
        connection
            .query_row(
                "SELECT id, account_id, mime_message_json, status, retry_count, last_error, queued_at, updated_at
                 FROM outbox_messages
                 WHERE id = ?1",
                params![id],
                map_outbox_message,
            )
            .optional()
            .map_err(|error| DomainError::Database(error.to_string()))
    }

    async fn find_by_status(
        &self,
        account_id: &str,
        status: OutboxStatus,
    ) -> Result<Vec<OutboxMessage>, DomainError> {
        let connection = self.db.connection()?;
        let mut statement = connection
            .prepare(
                "SELECT id, account_id, mime_message_json, status, retry_count, last_error, queued_at, updated_at
                 FROM outbox_messages
                 WHERE account_id = ?1 AND status = ?2
                 ORDER BY queued_at ASC",
            )
            .map_err(|error| DomainError::Database(error.to_string()))?;
        let messages = statement
            .query_map(
                params![account_id, status_to_string(&status)],
                map_outbox_message,
            )
            .map_err(|error| DomainError::Database(error.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| DomainError::Database(error.to_string()))?;

        Ok(messages)
    }

    async fn save(&self, message: &OutboxMessage) -> Result<(), DomainError> {
        let connection = self.db.connection()?;
        connection
            .execute(
                "INSERT INTO outbox_messages (
                    id, account_id, mime_message_json, status, retry_count, last_error, queued_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(id) DO UPDATE SET
                    mime_message_json = excluded.mime_message_json,
                    status = excluded.status,
                    retry_count = excluded.retry_count,
                    last_error = excluded.last_error,
                    updated_at = excluded.updated_at",
                params![
                    message.id,
                    message.account_id,
                    serde_json::to_string(&message.mime_message)
                        .map_err(|error| DomainError::Validation(error.to_string()))?,
                    status_to_string(&message.status),
                    message.retry_count,
                    message.last_error,
                    message.queued_at.to_rfc3339(),
                    message.updated_at.to_rfc3339(),
                ],
            )
            .map_err(|error| DomainError::Database(error.to_string()))?;

        Ok(())
    }
}

fn map_outbox_message(row: &Row<'_>) -> rusqlite::Result<OutboxMessage> {
    let mime_message_json: String = row.get(2)?;
    Ok(OutboxMessage {
        id: row.get(0)?,
        account_id: row.get(1)?,
        mime_message: serde_json::from_str::<MimeMessage>(&mime_message_json).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(2, Type::Text, Box::new(error))
        })?,
        status: status_from_string(&row.get::<_, String>(3)?),
        retry_count: row.get(4)?,
        last_error: row.get(5)?,
        queued_at: parse_timestamp(&row.get::<_, String>(6)?),
        updated_at: parse_timestamp(&row.get::<_, String>(7)?),
    })
}

fn status_to_string(status: &OutboxStatus) -> &'static str {
    match status {
        OutboxStatus::Queued => "queued",
        OutboxStatus::Sending => "sending",
        OutboxStatus::Sent => "sent",
        OutboxStatus::Failed => "failed",
    }
}

fn status_from_string(value: &str) -> OutboxStatus {
    match value {
        "sending" => OutboxStatus::Sending,
        "sent" => OutboxStatus::Sent,
        "failed" => OutboxStatus::Failed,
        _ => OutboxStatus::Queued,
    }
}

fn parse_timestamp(value: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(value)
        .map(|timestamp| timestamp.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now())
}
