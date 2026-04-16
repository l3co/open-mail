use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::infrastructure::sync::MimeMessage;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OutboxMessage {
    pub id: String,
    pub account_id: String,
    pub mime_message: MimeMessage,
    pub status: OutboxStatus,
    pub retry_count: u32,
    pub last_error: Option<String>,
    pub queued_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum OutboxStatus {
    Queued,
    Sending,
    Sent,
    Failed,
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;

    use super::*;
    use crate::infrastructure::sync::{MailAddress, MimeMessage};

    #[test]
    fn serializes_outbox_messages() {
        let timestamp = DateTime::parse_from_rfc3339("2026-03-13T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let message = OutboxMessage {
            id: "out_1".into(),
            account_id: "acc_1".into(),
            mime_message: MimeMessage {
                from: MailAddress {
                    name: None,
                    email: "leco@example.com".into(),
                },
                to: vec![MailAddress {
                    name: Some("Team".into()),
                    email: "team@example.com".into(),
                }],
                cc: vec![],
                bcc: vec![],
                reply_to: None,
                subject: "Queued".into(),
                html_body: "<p>Hello</p>".into(),
                plain_body: Some("Hello".into()),
                in_reply_to: None,
                references: vec![],
                attachments: vec![],
            },
            status: OutboxStatus::Queued,
            retry_count: 0,
            last_error: None,
            queued_at: timestamp,
            updated_at: timestamp,
        };

        let json = serde_json::to_string(&message).unwrap();
        assert!(json.contains("\"status\":\"queued\""));
        assert!(json.contains("team@example.com"));
    }
}
