use std::collections::HashMap;

use chrono::Utc;

use crate::domain::models::{message::Message, thread::Thread};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ThreadAssignment {
    ExistingThread { thread_id: String },
    NewThread { thread: Thread },
}

pub struct ThreadBuilder;

impl ThreadBuilder {
    pub fn assign_thread(
        message: &Message,
        existing_threads: &[Thread],
        existing_messages: &[Message],
    ) -> ThreadAssignment {
        if let Some(thread_id) = find_referenced_thread(message, existing_messages) {
            return ThreadAssignment::ExistingThread { thread_id };
        }

        if let Some(thread) = existing_threads
            .iter()
            .find(|thread| subject_matches(&thread.subject, &message.subject))
            .filter(|thread| shares_participants(thread, message))
        {
            return ThreadAssignment::ExistingThread {
                thread_id: thread.id.clone(),
            };
        }

        ThreadAssignment::NewThread {
            thread: new_thread_from_message(message),
        }
    }

    pub fn rebuild_threads(messages: &[Message]) -> Vec<Thread> {
        let mut buckets: HashMap<String, Vec<Message>> = HashMap::new();
        let mut message_id_to_bucket = HashMap::new();

        for message in messages {
            let bucket = message
                .references
                .iter()
                .chain(message.in_reply_to.iter())
                .find_map(|reference| message_id_to_bucket.get(reference).cloned())
                .unwrap_or_else(|| conversation_key(message));

            message_id_to_bucket.insert(message.message_id_header.clone(), bucket.clone());
            buckets.entry(bucket).or_default().push(message.clone());
        }

        let mut threads = buckets
            .into_values()
            .filter_map(|bucket_messages| {
                let first_message = bucket_messages.first()?;
                let mut thread = new_thread_from_message(first_message);
                thread.update_from_messages(&bucket_messages);
                Some(thread)
            })
            .collect::<Vec<_>>();
        threads.sort_by_key(|thread| std::cmp::Reverse(thread.last_message_at));
        threads
    }
}

fn find_referenced_thread(message: &Message, existing_messages: &[Message]) -> Option<String> {
    message
        .references
        .iter()
        .chain(message.in_reply_to.iter())
        .find_map(|reference| {
            existing_messages
                .iter()
                .find(|existing| existing.message_id_header == *reference)
                .map(|existing| existing.thread_id.clone())
        })
}

fn new_thread_from_message(message: &Message) -> Thread {
    let now = Utc::now();
    let mut thread = Thread {
        id: format!("thr_{}", stable_token(&message.message_id_header)),
        account_id: message.account_id.clone(),
        subject: message.subject.clone(),
        snippet: message.snippet.clone(),
        message_count: 0,
        participant_ids: vec![],
        folder_ids: vec![],
        label_ids: vec![],
        has_attachments: false,
        is_unread: false,
        is_starred: false,
        last_message_at: message.date,
        last_message_sent_at: None,
        created_at: now,
        updated_at: now,
    };
    thread.update_from_messages(std::slice::from_ref(message));
    thread
}

fn conversation_key(message: &Message) -> String {
    format!(
        "{}:{}",
        normalize_subject(&message.subject),
        participant_key(message)
    )
}

fn subject_matches(left: &str, right: &str) -> bool {
    if is_forward_subject(left) || is_forward_subject(right) {
        return false;
    }

    normalize_subject(left) == normalize_subject(right)
}

fn shares_participants(thread: &Thread, message: &Message) -> bool {
    let participant_ids = message
        .from
        .iter()
        .chain(message.to.iter())
        .chain(message.cc.iter())
        .chain(message.bcc.iter())
        .map(|contact| contact.id.as_str())
        .collect::<Vec<_>>();

    participant_ids.iter().any(|participant_id| {
        thread
            .participant_ids
            .iter()
            .any(|existing| existing == participant_id)
    })
}

fn participant_key(message: &Message) -> String {
    let mut participants = message
        .from
        .iter()
        .chain(message.to.iter())
        .chain(message.cc.iter())
        .chain(message.bcc.iter())
        .map(|contact| contact.email.to_ascii_lowercase())
        .collect::<Vec<_>>();
    participants.sort();
    participants.dedup();
    participants.join(",")
}

fn normalize_subject(subject: &str) -> String {
    let mut normalized = subject.trim().to_ascii_lowercase();

    loop {
        let stripped = normalized
            .strip_prefix("re:")
            .or_else(|| normalized.strip_prefix("fw:"))
            .or_else(|| normalized.strip_prefix("fwd:"));
        let Some(value) = stripped else {
            break;
        };
        normalized = value.trim().to_string();
    }

    normalized
}

fn is_forward_subject(subject: &str) -> bool {
    let normalized = subject.trim().to_ascii_lowercase();
    normalized.starts_with("fw:") || normalized.starts_with("fwd:")
}

fn stable_token(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use chrono::DateTime;

    use super::*;
    use crate::domain::models::contact::Contact;

    fn contact(id: &str, email: &str) -> Contact {
        let now = Utc::now();
        Contact {
            id: id.into(),
            account_id: "acc_1".into(),
            name: None,
            email: email.into(),
            is_me: false,
            created_at: now,
            updated_at: now,
        }
    }

    fn message(id: &str, subject: &str, minute: u8) -> Message {
        let timestamp = DateTime::parse_from_rfc3339(&format!("2026-03-13T10:{minute:02}:00Z"))
            .unwrap()
            .with_timezone(&Utc);

        Message {
            id: id.into(),
            account_id: "acc_1".into(),
            thread_id: format!("thr_{id}"),
            from: vec![contact("alice", "alice@example.com")],
            to: vec![contact("bob", "bob@example.com")],
            cc: vec![],
            bcc: vec![],
            reply_to: vec![],
            subject: subject.into(),
            snippet: format!("Snippet {id}"),
            body: "<p>Hello</p>".into(),
            plain_text: Some("Hello".into()),
            message_id_header: format!("<{id}@example.com>"),
            in_reply_to: None,
            references: vec![],
            folder_id: "fld_inbox".into(),
            label_ids: vec![],
            is_unread: true,
            is_starred: false,
            is_draft: false,
            date: timestamp,
            attachments: vec![],
            headers: HashMap::new(),
            created_at: timestamp,
            updated_at: timestamp,
        }
    }

    #[test]
    fn assigns_reply_to_existing_thread_by_message_id() {
        let original = message("msg_1", "Launch", 1);
        let mut reply = message("msg_2", "Re: Launch", 2);
        reply.in_reply_to = Some(original.message_id_header.clone());

        let assignment = ThreadBuilder::assign_thread(&reply, &[], &[original.clone()]);

        assert_eq!(
            assignment,
            ThreadAssignment::ExistingThread {
                thread_id: original.thread_id
            }
        );
    }

    #[test]
    fn assigns_by_normalized_subject_and_participants() {
        let original = message("msg_1", "Launch", 1);
        let existing_thread = new_thread_from_message(&original);
        let follow_up = message("msg_2", "Re: Launch", 2);

        let assignment = ThreadBuilder::assign_thread(&follow_up, &[existing_thread.clone()], &[]);

        assert_eq!(
            assignment,
            ThreadAssignment::ExistingThread {
                thread_id: existing_thread.id
            }
        );
    }

    #[test]
    fn forwards_create_new_thread_without_reference() {
        let original = message("msg_1", "Launch", 1);
        let existing_thread = new_thread_from_message(&original);
        let forward = message("msg_2", "Fwd: Launch", 2);

        let assignment = ThreadBuilder::assign_thread(&forward, &[existing_thread], &[]);

        assert!(matches!(assignment, ThreadAssignment::NewThread { .. }));
    }

    #[test]
    fn rebuilds_threads_and_updates_metadata() {
        let original = message("msg_1", "Launch", 1);
        let mut reply = message("msg_2", "Re: Launch", 2);
        reply.in_reply_to = Some(original.message_id_header.clone());
        reply.references = vec![original.message_id_header.clone()];

        let threads = ThreadBuilder::rebuild_threads(&[original, reply]);

        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].message_count, 2);
        assert_eq!(threads[0].snippet, "Snippet msg_2");
    }
}
