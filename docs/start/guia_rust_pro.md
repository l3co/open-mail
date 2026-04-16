# Guia Rust Pro — Padrões Avançados para o Open Mail

> Cada seção contém: problema identificado, solução proposta, código de referência e testes.
> Este guia eleva o backend de "funcional" para "engenharia de Staff level".

---

## §1 — Cargo Workspace & Organização de Crates

### Problema
O roadmap coloca tudo em `src-tauri/src/`. Conforme cresce, compilação fica lenta e responsabilidades se misturam.

### Solução
Usar **Cargo workspace** com crates separados por bounded context:

```
src-tauri/
├── Cargo.toml              # [workspace]
├── crates/
│   ├── openmail-core/      # Domain models, traits, errors, events
│   │   ├── Cargo.toml
│   │   └── src/
│   ├── openmail-db/        # SQLite, repositories, migrations
│   │   ├── Cargo.toml
│   │   └── src/
│   ├── openmail-sync/      # IMAP, SMTP, OAuth, sync workers
│   │   ├── Cargo.toml
│   │   └── src/
│   ├── openmail-search/    # Tantivy full-text search
│   │   ├── Cargo.toml
│   │   └── src/
│   └── openmail-plugins/   # WASM host, plugin lifecycle
│       ├── Cargo.toml
│       └── src/
└── src/
    ├── main.rs             # Entry point
    ├── lib.rs              # Tauri setup, command registration
    └── commands/           # Thin Tauri command handlers
```

```toml
# src-tauri/Cargo.toml
[workspace]
members = ["crates/*"]
resolver = "2"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
tracing = "0.1"

[package]
name = "open-mail"
version = "0.1.0"
edition = "2021"

[dependencies]
openmail-core = { path = "crates/openmail-core" }
openmail-db = { path = "crates/openmail-db" }
openmail-sync = { path = "crates/openmail-sync" }
openmail-search = { path = "crates/openmail-search" }
openmail-plugins = { path = "crates/openmail-plugins" }
tauri = { version = "2", features = ["tray-icon"] }
```

### Benefícios
- **Compilação incremental**: mudar um model não recompila o sync engine
- **Dependency direction enforcement**: `openmail-core` não pode importar `openmail-db`
- **Testes isolados**: `cargo test -p openmail-core` roda em <1s

---

## §2 — Geração Automática de Tipos com `ts-rs`

### Problema
Manter `types.ts` sincronizado manualmente com Rust é frágil. Qualquer divergência causa bugs silenciosos em runtime.

### Solução
Usar `ts-rs` para gerar tipos TypeScript automaticamente a partir dos structs Rust:

```toml
# crates/openmail-core/Cargo.toml
[dependencies]
ts-rs = { version = "10", features = ["chrono-impl", "uuid-impl", "serde-json-impl"] }
```

```rust
// crates/openmail-core/src/models/thread.rs
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct Thread {
    pub id: ThreadId,
    pub account_id: AccountId,
    pub subject: Subject,
    pub snippet: Snippet,
    pub message_count: u32,
    pub participant_ids: Vec<ContactId>,
    pub folder_ids: Vec<FolderId>,
    pub label_ids: Vec<LabelId>,
    pub has_attachments: bool,
    pub is_unread: bool,
    pub is_starred: bool,
    pub last_message_at: DateTime<Utc>,
    pub last_message_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

Script de geração:

```bash
# scripts/generate-types.sh
#!/bin/bash
set -euo pipefail

echo "Generating TypeScript bindings from Rust types..."
cargo test -p openmail-core export_bindings -- --nocapture
echo "Done! Types written to src/lib/bindings/"
```

```rust
// crates/openmail-core/tests/export_bindings.rs
#[test]
fn export_bindings() {
    // ts-rs auto-exports all types with #[ts(export)]
    // Este teste garante que a geração não quebra
    Thread::export().unwrap();
    Message::export().unwrap();
    Account::export().unwrap();
    Folder::export().unwrap();
    Contact::export().unwrap();
    Label::export().unwrap();
    Attachment::export().unwrap();
}
```

### CI Integration
```yaml
# .github/workflows/ci.yml - adicionar step
- name: Check TypeScript bindings are up to date
  run: |
    ./scripts/generate-types.sh
    git diff --exit-code src/lib/bindings/
```

---

## §3 — Newtype IDs (Type-Safe Identifiers)

### Problema
No roadmap atual, todos os IDs são `String`. Isso permite erros como:
```rust
// Compila, mas é um bug: thread_id no lugar de account_id
repo.find_by_folder(&thread.id, &account.id, 0, 50).await
```

### Solução
Newtype pattern com macro para gerar IDs type-safe:

```rust
// crates/openmail-core/src/models/ids.rs
use serde::{Deserialize, Serialize};
use std::fmt;
use ts_rs::TS;

macro_rules! define_id {
    ($name:ident) => {
        #[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
        #[ts(export, export_to = "../src/lib/bindings/")]
        pub struct $name(String);

        impl $name {
            pub fn new() -> Self {
                Self(uuid::Uuid::new_v4().to_string())
            }

            pub fn from_existing(id: impl Into<String>) -> Self {
                Self(id.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl AsRef<str> for $name {
            fn as_ref(&self) -> &str {
                &self.0
            }
        }

        // Para uso com rusqlite
        impl rusqlite::types::FromSql for $name {
            fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
                value.as_str().map(|s| Self(s.to_string()))
            }
        }

        impl rusqlite::types::ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
                Ok(rusqlite::types::ToSqlOutput::from(self.0.as_str()))
            }
        }
    };
}

define_id!(AccountId);
define_id!(ThreadId);
define_id!(MessageId);
define_id!(FolderId);
define_id!(LabelId);
define_id!(ContactId);
define_id!(AttachmentId);
define_id!(DraftId);
```

### Agora o compilador pega o bug:
```rust
// ERRO DE COMPILAÇÃO: expected AccountId, found ThreadId
repo.find_by_folder(&thread.id, &account.id, 0, 50).await
//                   ^^^^^^^^^^ ThreadId ≠ AccountId
```

---

## §4 — Value Objects

### Problema
`String` para email, snippet, subject não expressa domínio. Um email inválido passa silenciosamente.

### Solução

```rust
// crates/openmail-core/src/models/value_objects.rs
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct EmailAddress(String);

#[derive(Error, Debug)]
#[error("Invalid email address: {0}")]
pub struct InvalidEmail(String);

impl EmailAddress {
    pub fn new(value: impl Into<String>) -> Result<Self, InvalidEmail> {
        let value = value.into();
        // Validação simples mas eficaz
        if value.contains('@') && value.len() >= 3 {
            let parts: Vec<&str> = value.split('@').collect();
            if parts.len() == 2 && !parts[0].is_empty() && parts[1].contains('.') {
                return Ok(Self(value.to_lowercase()));
            }
        }
        Err(InvalidEmail(value))
    }

    pub fn local_part(&self) -> &str {
        self.0.split('@').next().unwrap()
    }

    pub fn domain(&self) -> &str {
        self.0.split('@').nth(1).unwrap()
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for EmailAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// --- Subject ---

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct Subject(String);

impl Subject {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    /// Remove prefixos Re:/Fwd: para comparação de threading
    pub fn normalized(&self) -> &str {
        let mut s = self.0.as_str();
        loop {
            let trimmed = s.trim_start();
            if let Some(rest) = trimmed.strip_prefix("Re:").or_else(|| trimmed.strip_prefix("RE:"))
                .or_else(|| trimmed.strip_prefix("Fwd:")).or_else(|| trimmed.strip_prefix("FWD:"))
                .or_else(|| trimmed.strip_prefix("Fw:"))
            {
                s = rest;
            } else {
                return trimmed;
            }
        }
    }

    pub fn as_reply(&self) -> Self {
        if self.0.starts_with("Re:") || self.0.starts_with("RE:") {
            self.clone()
        } else {
            Self(format!("Re: {}", self.0))
        }
    }

    pub fn as_forward(&self) -> Self {
        if self.0.starts_with("Fwd:") || self.0.starts_with("FWD:") {
            self.clone()
        } else {
            Self(format!("Fwd: {}", self.0))
        }
    }
}

// --- Snippet ---

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct Snippet(String);

impl Snippet {
    const MAX_LENGTH: usize = 200;

    pub fn from_body(html: &str) -> Self {
        // Remove tags HTML, normaliza whitespace, trunca
        let text = html_to_text(html);
        let truncated = if text.len() > Self::MAX_LENGTH {
            format!("{}...", &text[..Self::MAX_LENGTH])
        } else {
            text
        };
        Self(truncated)
    }

    pub fn empty() -> Self {
        Self(String::new())
    }
}

fn html_to_text(html: &str) -> String {
    // Remove tags, decode entities, normalize whitespace
    let without_tags = html
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</p>", "\n")
        .replace("</div>", "\n");

    // Strip remaining tags
    let mut result = String::with_capacity(without_tags.len());
    let mut in_tag = false;
    for c in without_tags.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }

    // Normalize whitespace
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_validation() {
        assert!(EmailAddress::new("alice@example.com").is_ok());
        assert!(EmailAddress::new("invalid").is_err());
        assert!(EmailAddress::new("@example.com").is_err());
        assert!(EmailAddress::new("alice@").is_err());
    }

    #[test]
    fn email_normalizes_case() {
        let email = EmailAddress::new("Alice@Example.COM").unwrap();
        assert_eq!(email.as_str(), "alice@example.com");
    }

    #[test]
    fn subject_normalization() {
        let s = Subject::new("Re: Re: Fwd: Hello World");
        assert_eq!(s.normalized(), "Hello World");
    }

    #[test]
    fn snippet_truncation() {
        let long_html = "<p>".to_string() + &"a".repeat(300) + "</p>";
        let snippet = Snippet::from_body(&long_html);
        assert!(snippet.0.len() <= Snippet::MAX_LENGTH + 3); // +3 for "..."
    }
}
```

---

## §5 — Rich Domain Models (Anti-Anêmico)

### Problema
O roadmap lista structs como "bags of data". Regras de negócio ficam espalhadas pelos commands.

### Solução
Modelos com comportamento encapsulado:

```rust
// crates/openmail-core/src/models/thread.rs

impl Thread {
    /// Cria um novo thread a partir da primeira mensagem
    pub fn from_first_message(message: &Message) -> Self {
        Self {
            id: ThreadId::new(),
            account_id: message.account_id.clone(),
            subject: message.subject.clone(),
            snippet: Snippet::from_body(&message.body),
            message_count: 1,
            participant_ids: message.all_participant_ids(),
            folder_ids: vec![message.folder_id.clone()],
            label_ids: message.label_ids.clone(),
            has_attachments: !message.attachments.is_empty(),
            is_unread: message.is_unread,
            is_starred: message.is_starred,
            last_message_at: message.date,
            last_message_sent_at: if message.is_sent() { Some(message.date) } else { None },
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Recalcula metadados do thread a partir de todas as mensagens
    pub fn recompute_from_messages(&mut self, messages: &[Message]) {
        if messages.is_empty() {
            return;
        }

        self.message_count = messages.len() as u32;
        self.is_unread = messages.iter().any(|m| m.is_unread);
        self.is_starred = messages.iter().any(|m| m.is_starred);
        self.has_attachments = messages.iter().any(|m| !m.attachments.is_empty());

        // Snippet da última mensagem
        if let Some(last) = messages.iter().max_by_key(|m| m.date) {
            self.snippet = Snippet::from_body(&last.body);
            self.last_message_at = last.date;
        }

        // Último envio meu
        self.last_message_sent_at = messages
            .iter()
            .filter(|m| m.is_sent())
            .map(|m| m.date)
            .max();

        // Participantes únicos
        let mut participant_set = std::collections::HashSet::new();
        for msg in messages {
            for pid in msg.all_participant_ids() {
                participant_set.insert(pid);
            }
        }
        self.participant_ids = participant_set.into_iter().collect();

        // Folders e labels únicos
        let mut folder_set: std::collections::HashSet<FolderId> = std::collections::HashSet::new();
        let mut label_set: std::collections::HashSet<LabelId> = std::collections::HashSet::new();
        for msg in messages {
            folder_set.insert(msg.folder_id.clone());
            for lid in &msg.label_ids {
                label_set.insert(lid.clone());
            }
        }
        self.folder_ids = folder_set.into_iter().collect();
        self.label_ids = label_set.into_iter().collect();

        self.updated_at = Utc::now();
    }

    /// Verifica se este thread pertence a um folder específico
    pub fn is_in_folder(&self, folder_id: &FolderId) -> bool {
        self.folder_ids.contains(folder_id)
    }

    /// Verifica se este thread tem uma label específica
    pub fn has_label(&self, label_id: &LabelId) -> bool {
        self.label_ids.contains(label_id)
    }
}

impl Message {
    /// Retorna todos os IDs de participantes (from + to + cc)
    pub fn all_participant_ids(&self) -> Vec<ContactId> {
        let mut ids = Vec::new();
        for c in &self.from { ids.push(c.id.clone()); }
        for c in &self.to { ids.push(c.id.clone()); }
        for c in &self.cc { ids.push(c.id.clone()); }
        ids.sort();
        ids.dedup();
        ids
    }

    /// Verifica se é uma mensagem enviada por mim
    pub fn is_sent(&self) -> bool {
        self.from.iter().any(|c| c.is_me)
    }

    /// Verifica se é uma resposta
    pub fn is_reply(&self) -> bool {
        self.in_reply_to.is_some() || !self.references.is_empty()
    }

    /// Verifica se é um forward
    pub fn is_forward(&self) -> bool {
        self.subject.0.starts_with("Fwd:") || self.subject.0.starts_with("FWD:")
    }

    /// Tamanho total dos attachments em bytes
    pub fn total_attachment_size(&self) -> u64 {
        self.attachments.iter().map(|a| a.size).sum()
    }
}
```

---

## §6 — Builder Pattern para Criação Complexa

### Problema
Criar um `Message` requer ~20 campos. Construtores ficam ilegíveis.

### Solução
Builder com validação no `build()`:

```rust
// crates/openmail-core/src/models/message_builder.rs

pub struct MessageBuilder {
    account_id: Option<AccountId>,
    thread_id: Option<ThreadId>,
    from: Vec<Contact>,
    to: Vec<Contact>,
    cc: Vec<Contact>,
    bcc: Vec<Contact>,
    subject: Option<Subject>,
    body: String,
    plain_text: Option<String>,
    folder_id: Option<FolderId>,
    is_draft: bool,
    in_reply_to: Option<String>,
    references: Vec<String>,
    attachments: Vec<Attachment>,
}

impl MessageBuilder {
    pub fn new() -> Self {
        Self {
            account_id: None,
            thread_id: None,
            from: Vec::new(),
            to: Vec::new(),
            cc: Vec::new(),
            bcc: Vec::new(),
            subject: None,
            body: String::new(),
            plain_text: None,
            folder_id: None,
            is_draft: false,
            in_reply_to: None,
            references: Vec::new(),
            attachments: Vec::new(),
        }
    }

    pub fn account(mut self, id: AccountId) -> Self {
        self.account_id = Some(id);
        self
    }

    pub fn thread(mut self, id: ThreadId) -> Self {
        self.thread_id = Some(id);
        self
    }

    pub fn from_contact(mut self, contact: Contact) -> Self {
        self.from.push(contact);
        self
    }

    pub fn to(mut self, contact: Contact) -> Self {
        self.to.push(contact);
        self
    }

    pub fn cc(mut self, contact: Contact) -> Self {
        self.cc.push(contact);
        self
    }

    pub fn bcc(mut self, contact: Contact) -> Self {
        self.bcc.push(contact);
        self
    }

    pub fn subject(mut self, subject: impl Into<String>) -> Self {
        self.subject = Some(Subject::new(subject));
        self
    }

    pub fn body(mut self, html: impl Into<String>) -> Self {
        self.body = html.into();
        self
    }

    pub fn plain_text(mut self, text: impl Into<String>) -> Self {
        self.plain_text = Some(text.into());
        self
    }

    pub fn folder(mut self, id: FolderId) -> Self {
        self.folder_id = Some(id);
        self
    }

    pub fn as_draft(mut self) -> Self {
        self.is_draft = true;
        self
    }

    pub fn in_reply_to(mut self, message_id: impl Into<String>) -> Self {
        self.in_reply_to = Some(message_id.into());
        self
    }

    pub fn references(mut self, refs: Vec<String>) -> Self {
        self.references = refs;
        self
    }

    pub fn attachment(mut self, att: Attachment) -> Self {
        self.attachments.push(att);
        self
    }

    pub fn build(self) -> Result<Message, DomainError> {
        let account_id = self.account_id
            .ok_or(DomainError::Validation("account_id is required".into()))?;
        let subject = self.subject
            .ok_or(DomainError::Validation("subject is required".into()))?;
        let folder_id = self.folder_id
            .ok_or(DomainError::Validation("folder_id is required".into()))?;

        if self.from.is_empty() {
            return Err(DomainError::Validation("at least one sender required".into()));
        }

        let now = Utc::now();
        let snippet = Snippet::from_body(&self.body);

        Ok(Message {
            id: MessageId::new(),
            account_id,
            thread_id: self.thread_id.unwrap_or_else(ThreadId::new),
            from: self.from,
            to: self.to,
            cc: self.cc,
            bcc: self.bcc,
            reply_to: Vec::new(),
            subject,
            snippet,
            body: self.body,
            plain_text: self.plain_text,
            message_id_header: generate_message_id(),
            in_reply_to: self.in_reply_to,
            references: self.references,
            folder_id,
            label_ids: Vec::new(),
            is_unread: false,
            is_starred: false,
            is_draft: self.is_draft,
            date: now,
            attachments: self.attachments,
            headers: std::collections::HashMap::new(),
            created_at: now,
            updated_at: now,
        })
    }
}

fn generate_message_id() -> String {
    format!("<{}.{}@openmail.app>", uuid::Uuid::new_v4(), chrono::Utc::now().timestamp())
}

// Uso:
// let msg = MessageBuilder::new()
//     .account(account_id)
//     .from_contact(me)
//     .to(alice)
//     .subject("Hello")
//     .body("<p>World</p>")
//     .folder(inbox_id)
//     .build()?;
```

---

## §7 — CQRS-Lite (Read Models vs Write Models)

### Problema
O frontend não precisa de todos os campos de um Thread para renderizar a lista. Serializar `body` (HTML potencialmente grande) para cada thread na lista é desperdício.

### Solução
Separar modelos de leitura (otimizados para views) dos modelos de escrita (domínio completo):

```rust
// crates/openmail-core/src/read_models.rs

/// Modelo leve para a thread list — sem body, sem headers
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct ThreadSummary {
    pub id: ThreadId,
    pub account_id: AccountId,
    pub subject: String,
    pub snippet: String,
    pub sender_name: String,
    pub sender_email: String,
    pub sender_avatar_hash: String,  // para gerar avatar colorido
    pub message_count: u32,
    pub has_attachments: bool,
    pub is_unread: bool,
    pub is_starred: bool,
    pub last_message_at: DateTime<Utc>,
    pub label_names: Vec<String>,
    pub label_colors: Vec<Option<String>>,
}

/// Modelo completo para a message view
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct MessageDetail {
    pub id: MessageId,
    pub thread_id: ThreadId,
    pub from: Vec<ContactInfo>,
    pub to: Vec<ContactInfo>,
    pub cc: Vec<ContactInfo>,
    pub subject: String,
    pub body: String,
    pub plain_text: Option<String>,
    pub date: DateTime<Utc>,
    pub is_unread: bool,
    pub is_starred: bool,
    pub attachments: Vec<AttachmentInfo>,
    pub in_reply_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct ContactInfo {
    pub name: Option<String>,
    pub email: String,
    pub avatar_hash: String,
    pub is_me: bool,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct AttachmentInfo {
    pub id: AttachmentId,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub is_inline: bool,
}

/// Modelo para a sidebar — contagem por folder
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../src/lib/bindings/")]
pub struct FolderSummary {
    pub id: FolderId,
    pub name: String,
    pub role: Option<FolderRole>,
    pub unread_count: u32,
    pub total_count: u32,
}
```

### Queries Otimizadas

```rust
// crates/openmail-db/src/queries/thread_queries.rs

impl SqliteThreadRepository {
    /// Query otimizada para thread list — JOIN direto, sem N+1
    pub async fn list_summaries(
        &self,
        account_id: &AccountId,
        folder_id: &FolderId,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<ThreadSummary>, DomainError> {
        let conn = self.pool.get()?;

        let mut stmt = conn.prepare_cached(
            "SELECT
                t.id, t.account_id, t.subject, t.snippet,
                t.message_count, t.has_attachments,
                t.is_unread, t.is_starred, t.last_message_at,
                -- Subquery para sender da última mensagem
                (SELECT m.from_json FROM messages m
                 WHERE m.thread_id = t.id
                 ORDER BY m.date DESC LIMIT 1) as last_sender_json,
                -- Subquery para labels
                (SELECT GROUP_CONCAT(l.display_name || '|' || COALESCE(l.color, ''), ',')
                 FROM thread_labels tl
                 JOIN labels l ON l.id = tl.label_id
                 WHERE tl.thread_id = t.id) as labels_str
             FROM threads t
             JOIN thread_folders tf ON tf.thread_id = t.id
             WHERE t.account_id = ?1 AND tf.folder_id = ?2
             ORDER BY t.last_message_at DESC
             LIMIT ?3 OFFSET ?4"
        )?;

        let summaries = stmt.query_map(
            rusqlite::params![account_id, folder_id, limit, offset],
            |row| {
                let last_sender_json: String = row.get(9)?;
                let labels_str: Option<String> = row.get(10)?;

                // Parse sender
                let sender: serde_json::Value = serde_json::from_str(&last_sender_json)
                    .unwrap_or_default();
                let sender_email = sender[0]["email"].as_str().unwrap_or("").to_string();
                let sender_name = sender[0]["name"].as_str().unwrap_or(&sender_email).to_string();

                // Parse labels
                let (label_names, label_colors) = parse_labels_str(labels_str);

                Ok(ThreadSummary {
                    id: row.get(0)?,
                    account_id: row.get(1)?,
                    subject: row.get(2)?,
                    snippet: row.get(3)?,
                    sender_name,
                    sender_email: sender_email.clone(),
                    sender_avatar_hash: avatar_hash(&sender_email),
                    message_count: row.get(4)?,
                    has_attachments: row.get(5)?,
                    is_unread: row.get(6)?,
                    is_starred: row.get(7)?,
                    last_message_at: row.get(8)?,
                    label_names,
                    label_colors,
                })
            },
        )?.collect::<Result<Vec<_>, _>>()?;

        Ok(summaries)
    }
}

/// Hash determinístico para gerar avatares coloridos consistentes
fn avatar_hash(email: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    email.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}
```

---

## §8 — SQL Type-Safe com `sea-query`

### Problema
SQL como strings raw é frágil e propenso a erros de digitação.

### Solução
`sea-query` para SQL builder type-safe:

```toml
# crates/openmail-db/Cargo.toml
[dependencies]
sea-query = { version = "0.32", features = ["backend-sqlite"] }
sea-query-rusqlite = "0.7"
```

```rust
// crates/openmail-db/src/schema.rs
use sea_query::Iden;

#[derive(Iden)]
pub enum Threads {
    Table,
    Id,
    AccountId,
    Subject,
    Snippet,
    MessageCount,
    HasAttachments,
    IsUnread,
    IsStarred,
    LastMessageAt,
    CreatedAt,
    UpdatedAt,
}

#[derive(Iden)]
pub enum Messages {
    Table,
    Id,
    AccountId,
    ThreadId,
    FolderId,
    Subject,
    Body,
    PlainText,
    FromJson,
    ToJson,
    CcJson,
    Date,
    IsUnread,
    IsStarred,
    IsDraft,
    CreatedAt,
    UpdatedAt,
}
```

```rust
// crates/openmail-db/src/repositories/thread_repo.rs
use sea_query::{Query, SqliteQueryBuilder, Expr};
use crate::schema::Threads;

impl SqliteThreadRepository {
    pub async fn find_starred(
        &self,
        account_id: &AccountId,
        limit: u32,
    ) -> Result<Vec<Thread>, DomainError> {
        let sql = Query::select()
            .columns([
                Threads::Id, Threads::AccountId, Threads::Subject,
                Threads::Snippet, Threads::MessageCount, Threads::IsUnread,
                Threads::IsStarred, Threads::LastMessageAt,
            ])
            .from(Threads::Table)
            .and_where(Expr::col(Threads::AccountId).eq(account_id.as_str()))
            .and_where(Expr::col(Threads::IsStarred).eq(true))
            .order_by(Threads::LastMessageAt, sea_query::Order::Desc)
            .limit(limit as u64)
            .to_string(SqliteQueryBuilder);

        // Execute...
        todo!()
    }
}
```

---

## §9 — Migrations com `refinery`

### Problema
SQL de migration em string estática é difícil de versionar e testar.

### Solução

```toml
# crates/openmail-db/Cargo.toml
[dependencies]
refinery = { version = "0.8", features = ["rusqlite"] }
```

```rust
// crates/openmail-db/src/migrations.rs
use refinery::embed_migrations;

embed_migrations!("./migrations");

pub fn run_migrations(conn: &mut rusqlite::Connection) -> Result<(), refinery::Error> {
    migrations::runner().run(conn)?;
    Ok(())
}
```

```
crates/openmail-db/migrations/
├── V1__initial_schema.sql
├── V2__add_sync_state.sql
├── V3__add_fts_index.sql
└── V4__add_scheduled_sends.sql
```

---

## §10 — Property-Based Testing com `proptest`

### Problema
Testes manuais cobrem casos conhecidos, mas edge cases passam.

### Solução

```toml
# crates/openmail-core/Cargo.toml
[dev-dependencies]
proptest = "1"
```

```rust
// crates/openmail-core/tests/property_tests.rs
use proptest::prelude::*;

proptest! {
    #[test]
    fn subject_normalization_is_idempotent(s in ".*") {
        let subject = Subject::new(&s);
        let normalized = subject.normalized();
        let re_normalized = Subject::new(normalized).normalized();
        assert_eq!(normalized, re_normalized);
    }

    #[test]
    fn email_address_roundtrips_through_serde(email in "[a-z]{1,10}@[a-z]{1,10}\\.[a-z]{2,4}") {
        let addr = EmailAddress::new(&email).unwrap();
        let json = serde_json::to_string(&addr).unwrap();
        let deserialized: EmailAddress = serde_json::from_str(&json).unwrap();
        assert_eq!(addr, deserialized);
    }

    #[test]
    fn thread_recompute_is_consistent(msg_count in 1..100usize) {
        let account_id = AccountId::new();
        let folder_id = FolderId::new();
        let messages: Vec<Message> = (0..msg_count)
            .map(|_| create_test_message(&account_id, &folder_id))
            .collect();

        let mut thread = Thread::from_first_message(&messages[0]);
        thread.recompute_from_messages(&messages);

        assert_eq!(thread.message_count as usize, msg_count);
        assert!(thread.last_message_at >= messages[0].date);
    }

    #[test]
    fn snippet_never_exceeds_max_length(html in "(<p>[a-zA-Z ]{0,500}</p>){1,10}") {
        let snippet = Snippet::from_body(&html);
        assert!(snippet.0.len() <= Snippet::MAX_LENGTH + 3);
    }
}
```

---

## §11 — Actor Model para Sync Workers

### Problema
O `SyncWorker` no roadmap original mistura state, I/O e lifecycle em um único struct. Difícil de testar e de cancelar operações individuais.

### Solução
Cada worker como actor com message passing:

```rust
// crates/openmail-sync/src/actor.rs
use tokio::sync::{mpsc, oneshot};

/// Mensagens que o SyncActor aceita
pub enum SyncCommand {
    /// Inicia sync cycle completo
    SyncNow,
    /// Sync de um folder específico
    SyncFolder { folder_id: FolderId },
    /// Força re-fetch de um thread
    RefetchThread { thread_id: ThreadId },
    /// Retorna status atual
    GetStatus { reply: oneshot::Sender<SyncStatus> },
    /// Para o actor gracefully
    Shutdown,
}

pub struct SyncStatus {
    pub state: SyncState,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub folders_synced: u32,
    pub messages_synced: u32,
    pub error_count: u32,
}

pub struct SyncActor {
    account_id: AccountId,
    receiver: mpsc::Receiver<SyncCommand>,
    imap_client: ImapClient,
    db: Arc<dyn ThreadRepository>,
    app_handle: AppHandle,
    status: SyncStatus,
}

impl SyncActor {
    pub fn spawn(
        account: &Account,
        db: Arc<dyn ThreadRepository>,
        app_handle: AppHandle,
    ) -> SyncActorHandle {
        let (sender, receiver) = mpsc::channel(32);

        let actor = Self {
            account_id: account.id.clone(),
            receiver,
            imap_client: ImapClient::new(/* ... */),
            db,
            app_handle,
            status: SyncStatus::default(),
        };

        let handle = tokio::spawn(actor.run());

        SyncActorHandle { sender, join_handle: handle }
    }

    async fn run(mut self) {
        tracing::info!(account_id = %self.account_id, "Sync actor started");

        loop {
            tokio::select! {
                // Processar comandos externos
                Some(cmd) = self.receiver.recv() => {
                    match cmd {
                        SyncCommand::SyncNow => {
                            if let Err(e) = self.sync_cycle().await {
                                self.handle_error(e).await;
                            }
                        }
                        SyncCommand::SyncFolder { folder_id } => {
                            if let Err(e) = self.sync_single_folder(&folder_id).await {
                                self.handle_error(e).await;
                            }
                        }
                        SyncCommand::GetStatus { reply } => {
                            let _ = reply.send(self.status.clone());
                        }
                        SyncCommand::Shutdown => {
                            tracing::info!(account_id = %self.account_id, "Sync actor shutting down");
                            break;
                        }
                        _ => {}
                    }
                }
                // IDLE timeout — sync periódico
                _ = tokio::time::sleep(std::time::Duration::from_secs(300)) => {
                    if let Err(e) = self.sync_cycle().await {
                        self.handle_error(e).await;
                    }
                }
            }
        }
    }

    #[tracing::instrument(skip(self), fields(account_id = %self.account_id))]
    async fn sync_cycle(&mut self) -> Result<(), SyncError> {
        self.status.state = SyncState::Running;
        self.emit_status().await;

        self.sync_folders().await?;

        let folders = self.get_folders_by_priority().await?;
        for folder in &folders {
            self.sync_single_folder(&folder.id).await?;
            self.status.folders_synced += 1;
        }

        self.status.state = SyncState::Sleeping;
        self.status.last_sync_at = Some(Utc::now());
        self.emit_status().await;
        Ok(())
    }

    async fn emit_status(&self) {
        let _ = self.app_handle.emit("sync:status", serde_json::json!({
            "accountId": self.account_id.as_str(),
            "state": self.status.state,
            "lastSyncAt": self.status.last_sync_at,
        }));
    }
}

/// Handle para interagir com o actor de fora
pub struct SyncActorHandle {
    sender: mpsc::Sender<SyncCommand>,
    join_handle: tokio::task::JoinHandle<()>,
}

impl SyncActorHandle {
    pub async fn sync_now(&self) -> Result<(), SyncError> {
        self.sender.send(SyncCommand::SyncNow).await
            .map_err(|_| SyncError::ActorStopped)
    }

    pub async fn get_status(&self) -> Result<SyncStatus, SyncError> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(SyncCommand::GetStatus { reply: tx }).await
            .map_err(|_| SyncError::ActorStopped)?;
        rx.await.map_err(|_| SyncError::ActorStopped)
    }

    pub async fn shutdown(self) -> Result<(), SyncError> {
        let _ = self.sender.send(SyncCommand::Shutdown).await;
        self.join_handle.await.map_err(|_| SyncError::ActorStopped)
    }
}
```

---

## §12 — Circuit Breaker para IMAP

### Problema
Se um servidor IMAP está fora, o sync fica tentando indefinidamente, consumindo CPU e network.

### Solução

```rust
// crates/openmail-sync/src/circuit_breaker.rs

#[derive(Debug, Clone)]
pub struct CircuitBreaker {
    state: CircuitState,
    failure_count: u32,
    last_failure_at: Option<Instant>,
    config: CircuitConfig,
}

#[derive(Debug, Clone)]
enum CircuitState {
    Closed,     // Normal — requests passam
    Open,       // Falhou demais — requests bloqueados
    HalfOpen,   // Tentando recovery
}

#[derive(Debug, Clone)]
pub struct CircuitConfig {
    pub failure_threshold: u32,     // Quantas falhas para abrir
    pub recovery_timeout: Duration, // Quanto tempo ficar aberto
    pub success_threshold: u32,     // Quantos successos para fechar
}

impl Default for CircuitConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            recovery_timeout: Duration::from_secs(60),
            success_threshold: 2,
        }
    }
}

impl CircuitBreaker {
    pub fn new(config: CircuitConfig) -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            last_failure_at: None,
            config,
        }
    }

    /// Verifica se o circuito permite uma operação
    pub fn can_execute(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                if let Some(last) = self.last_failure_at {
                    if last.elapsed() >= self.config.recovery_timeout {
                        self.state = CircuitState::HalfOpen;
                        tracing::info!("Circuit breaker transitioning to HalfOpen");
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    /// Registra sucesso
    pub fn record_success(&mut self) {
        match self.state {
            CircuitState::HalfOpen => {
                self.failure_count = 0;
                self.state = CircuitState::Closed;
                tracing::info!("Circuit breaker closed (recovered)");
            }
            _ => {
                self.failure_count = 0;
            }
        }
    }

    /// Registra falha
    pub fn record_failure(&mut self) {
        self.failure_count += 1;
        self.last_failure_at = Some(Instant::now());

        if self.failure_count >= self.config.failure_threshold {
            self.state = CircuitState::Open;
            tracing::warn!(
                failure_count = self.failure_count,
                "Circuit breaker opened"
            );
        }
    }
}

// Uso no sync worker:
impl SyncActor {
    async fn sync_with_circuit_breaker(&mut self) -> Result<(), SyncError> {
        if !self.circuit_breaker.can_execute() {
            tracing::debug!("Circuit breaker is open, skipping sync");
            return Ok(());
        }

        match self.sync_cycle().await {
            Ok(()) => {
                self.circuit_breaker.record_success();
                Ok(())
            }
            Err(e) => {
                self.circuit_breaker.record_failure();
                Err(e)
            }
        }
    }
}
```

---

## §13 — Tracing com Spans Estruturados

### Problema
`log::info!` é flat — não há correlação entre operações, nem timing automático.

### Solução
`tracing` com spans hierárquicos desde o dia 1:

```toml
# workspace Cargo.toml
[workspace.dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
tracing-appender = "0.2"
```

```rust
// src-tauri/src/lib.rs
use tracing_subscriber::{fmt, EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use tracing_appender::rolling;

pub fn setup_tracing(app_data_dir: &std::path::Path) {
    let log_dir = app_data_dir.join("logs");

    // File output: JSON, rotação diária
    let file_appender = rolling::daily(&log_dir, "open-mail.log");
    let file_layer = fmt::layer()
        .json()
        .with_writer(file_appender)
        .with_target(true)
        .with_span_events(fmt::format::FmtSpan::CLOSE);

    // Console output: human-readable (apenas em dev)
    let console_layer = fmt::layer()
        .pretty()
        .with_target(true)
        .with_span_events(fmt::format::FmtSpan::CLOSE);

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("open_mail=info,openmail_sync=debug")))
        .with(file_layer)
        .with(console_layer)
        .init();
}
```

```rust
// Uso nos sync workers — timing automático via spans
#[tracing::instrument(
    skip(self),
    fields(
        account_id = %self.account_id,
        folder_name = %folder.name,
        folder_id = %folder.id,
    )
)]
async fn sync_single_folder(&mut self, folder: &Folder) -> Result<SyncFolderResult, SyncError> {
    let status = self.imap_client.select_folder(&folder.path).await?;

    tracing::debug!(
        uid_validity = status.uid_validity,
        message_count = status.exists,
        "Folder selected"
    );

    let new_uids = self.imap_client.fetch_new_uids(last_uid).await?;
    tracing::info!(new_message_count = new_uids.len(), "Found new messages");

    for chunk in new_uids.chunks(50) {
        let _span = tracing::info_span!("fetch_batch", batch_size = chunk.len()).entered();
        let envelopes = self.imap_client.fetch_envelopes(chunk).await?;
        self.process_and_save(envelopes).await?;
    }

    Ok(SyncFolderResult { new_messages: new_uids.len() as u32 })
}
```

Output JSON (para análise):
```json
{
  "timestamp": "2025-03-12T20:00:00Z",
  "level": "INFO",
  "target": "openmail_sync::actor",
  "span": { "account_id": "abc123", "folder_name": "INBOX", "folder_id": "f1" },
  "fields": { "new_message_count": 5 },
  "message": "Found new messages"
}
```

---

## §14 — Graceful Shutdown

### Problema
Fechar o app enquanto sync está rodando pode corromper dados.

### Solução

```rust
// src-tauri/src/lib.rs
use tokio::signal;
use tokio_util::sync::CancellationToken;

pub struct AppLifecycle {
    shutdown_token: CancellationToken,
}

impl AppLifecycle {
    pub fn new() -> Self {
        Self {
            shutdown_token: CancellationToken::new(),
        }
    }

    pub fn shutdown_token(&self) -> CancellationToken {
        self.shutdown_token.clone()
    }

    /// Chamado pelo Tauri ao fechar a app
    pub async fn shutdown(&self, sync_manager: &SyncManager, db: &Database) {
        tracing::info!("Initiating graceful shutdown...");

        // 1. Sinalizar todos os actors para parar
        self.shutdown_token.cancel();

        // 2. Aguardar sync workers finalizarem (max 10s)
        let shutdown_timeout = Duration::from_secs(10);
        match tokio::time::timeout(shutdown_timeout, sync_manager.stop_all()).await {
            Ok(Ok(())) => tracing::info!("All sync workers stopped gracefully"),
            Ok(Err(e)) => tracing::warn!("Sync workers stopped with error: {}", e),
            Err(_) => tracing::warn!("Sync workers shutdown timed out"),
        }

        // 3. WAL checkpoint antes de fechar
        if let Err(e) = db.checkpoint() {
            tracing::error!("Failed to checkpoint database: {}", e);
        }

        // 4. Flush logs
        tracing::info!("Shutdown complete");
    }
}
```

---

## §15 — Delta Sync com CONDSTORE/QRESYNC

### Problema
O sync básico busca UIDs desde o último UID. Não detecta mudanças de flags em mensagens já sincronizadas.

### Solução
Usar extensões IMAP para sync eficiente:

```rust
// crates/openmail-sync/src/delta_sync.rs

pub struct DeltaSyncStrategy;

impl DeltaSyncStrategy {
    /// Detecta capabilities do servidor e escolhe estratégia
    pub fn choose(capabilities: &[String]) -> Box<dyn SyncStrategy> {
        if capabilities.iter().any(|c| c == "QRESYNC") {
            tracing::info!("Server supports QRESYNC — using delta sync");
            Box::new(QResyncStrategy)
        } else if capabilities.iter().any(|c| c == "CONDSTORE") {
            tracing::info!("Server supports CONDSTORE — using modseq sync");
            Box::new(CondstoreStrategy)
        } else {
            tracing::info!("Server has no extensions — using UID-based sync");
            Box::new(UidSyncStrategy)
        }
    }
}

#[async_trait]
pub trait SyncStrategy: Send + Sync {
    /// Retorna mudanças desde o último sync
    async fn detect_changes(
        &self,
        client: &mut ImapClient,
        folder: &Folder,
        sync_state: &FolderSyncState,
    ) -> Result<SyncDelta, SyncError>;
}

pub struct SyncDelta {
    pub new_uids: Vec<u32>,
    pub changed_uids: Vec<u32>,      // flags mudaram
    pub expunged_uids: Vec<u32>,     // deletados no servidor
    pub new_highest_modseq: Option<u64>,
}

struct QResyncStrategy;

#[async_trait]
impl SyncStrategy for QResyncStrategy {
    async fn detect_changes(
        &self,
        client: &mut ImapClient,
        folder: &Folder,
        sync_state: &FolderSyncState,
    ) -> Result<SyncDelta, SyncError> {
        // SELECT com QRESYNC: servidor retorna delta desde last_modseq
        // Altamente eficiente: uma operação para detectar tudo
        let response = client.select_with_qresync(
            &folder.path,
            sync_state.uid_validity.unwrap_or(0),
            sync_state.last_modseq.unwrap_or(0),
        ).await?;

        Ok(SyncDelta {
            new_uids: response.new_uids,
            changed_uids: response.changed_uids,
            expunged_uids: response.expunged_uids,
            new_highest_modseq: Some(response.highest_modseq),
        })
    }
}
```

---

## §16 — Outbox Pattern (Task Queue Persistente)

### Problema
Se o app fecha enquanto uma operação IMAP está na fila (mark as read, move), ela se perde.

### Solução
Fila persistente no SQLite:

```sql
-- migrations/V5__add_outbox.sql
CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, failed, completed
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    created_at TEXT NOT NULL,
    next_retry_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE INDEX idx_outbox_pending ON outbox(account_id, status, next_retry_at)
    WHERE status IN ('pending', 'failed');
```

```rust
// crates/openmail-sync/src/outbox.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxTask {
    pub id: String,
    pub account_id: AccountId,
    pub task_type: TaskType,
    pub payload: serde_json::Value,
    pub status: TaskStatus,
    pub attempts: u32,
    pub max_attempts: u32,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub next_retry_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskType {
    SetFlags,
    MoveMessages,
    DeleteMessages,
    AppendToSent,
    AppendToDrafts,
    ExpungeMessages,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Pending,
    Processing,
    Failed,
    Completed,
}

pub struct OutboxProcessor {
    db: Arc<Database>,
    imap_clients: Arc<RwLock<HashMap<AccountId, ImapClient>>>,
}

impl OutboxProcessor {
    /// Roda em loop, processando tasks pendentes
    pub async fn run(&self, shutdown: CancellationToken) {
        loop {
            tokio::select! {
                _ = shutdown.cancelled() => break,
                _ = tokio::time::sleep(Duration::from_secs(2)) => {
                    self.process_pending().await;
                }
            }
        }
    }

    async fn process_pending(&self) {
        let tasks = self.db.fetch_pending_tasks(10).await.unwrap_or_default();

        for task in tasks {
            let _span = tracing::info_span!(
                "outbox_task",
                task_id = %task.id,
                task_type = ?task.task_type,
                attempt = task.attempts + 1,
            ).entered();

            match self.execute_task(&task).await {
                Ok(()) => {
                    self.db.mark_completed(&task.id).await.ok();
                    tracing::info!("Task completed successfully");
                }
                Err(e) => {
                    let next_retry = Utc::now() + chrono::Duration::seconds(
                        (5 * 2_i64.pow(task.attempts)) .min(300)
                    );
                    self.db.mark_failed(&task.id, &e.to_string(), next_retry).await.ok();
                    tracing::warn!(error = %e, "Task failed, will retry");
                }
            }
        }
    }

    async fn execute_task(&self, task: &OutboxTask) -> Result<(), SyncError> {
        match task.task_type {
            TaskType::SetFlags => {
                let payload: SetFlagsPayload = serde_json::from_value(task.payload.clone())?;
                let client = self.get_client(&task.account_id).await?;
                client.set_flags(&payload.uids, &payload.flags, payload.add).await
            }
            TaskType::MoveMessages => {
                let payload: MovePayload = serde_json::from_value(task.payload.clone())?;
                let client = self.get_client(&task.account_id).await?;
                client.move_messages(&payload.uids, &payload.destination).await
            }
            // ... outros task types
            _ => Ok(())
        }
    }
}
```

### Uso nos Tauri Commands (Optimistic Update + Outbox):

```rust
#[tauri::command]
pub async fn archive_threads(
    state: State<'_, AppState>,
    thread_ids: Vec<ThreadId>,
) -> Result<(), DomainError> {
    let account_id = /* ... */;
    let archive_folder = state.folder_repo
        .find_by_role(&account_id, FolderRole::Archive).await?
        .ok_or(DomainError::NotFound {
            entity_type: "Folder".into(),
            id: "archive".into(),
        })?;

    // 1. Optimistic update local (instantâneo)
    state.thread_repo.move_to_folder(&thread_ids, &archive_folder.id).await?;

    // 2. Persistir na outbox (durável, sobrevive a crash)
    let message_uids = state.message_repo
        .get_uids_for_threads(&thread_ids).await?;

    state.outbox.enqueue(OutboxTask {
        id: uuid::Uuid::new_v4().to_string(),
        account_id: account_id.clone(),
        task_type: TaskType::MoveMessages,
        payload: serde_json::json!({
            "uids": message_uids,
            "destination": archive_folder.path,
        }),
        status: TaskStatus::Pending,
        attempts: 0,
        max_attempts: 5,
        last_error: None,
        created_at: Utc::now(),
        next_retry_at: Utc::now(),
    }).await?;

    // 3. Emitir evento para UI
    state.app.emit("db:threads-changed", &thread_ids)?;

    // 4. Retornar undo info
    Ok(())
}
```

---

## Resumo das Melhorias Rust

| Melhoria | Complexidade | Impacto | Quando |
|----------|-------------|---------|--------|
| Cargo Workspace | Média | Alto (build time, separação) | Fase 0 |
| ts-rs | Baixa | Alto (elimina divergência de tipos) | Fase 0 |
| Newtype IDs | Baixa | Alto (elimina classe de bugs) | Fase 1 |
| Value Objects | Baixa | Médio (domínio rico) | Fase 1 |
| Rich Domain Models | Média | Alto (regras no lugar certo) | Fase 1 |
| Builder Pattern | Baixa | Médio (legibilidade) | Fase 1 |
| CQRS-lite | Média | Alto (performance da lista) | Fase 1 |
| sea-query | Média | Médio (SQL type-safe) | Fase 1 |
| refinery | Baixa | Médio (migrations confiáveis) | Fase 1 |
| proptest | Baixa | Alto (edge cases) | Fase 1 |
| Actor Model | Alta | Alto (concorrência correta) | Fase 2 |
| Circuit Breaker | Média | Médio (resiliência) | Fase 2 |
| Tracing | Baixa | Alto (observabilidade) | Fase 0 |
| Graceful Shutdown | Média | Alto (integridade de dados) | Fase 2 |
| Delta Sync | Alta | Alto (eficiência de sync) | Fase 2 |
| Outbox Pattern | Média | Alto (durabilidade) | Fase 2 |
