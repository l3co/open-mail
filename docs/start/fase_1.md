# Fase 1 — Domain Models & Database Layer (Rust)

**Duracao estimada:** 3 semanas
**Dependencia:** Fase 0 concluida
**Objetivo:** Implementar os modelos de dominio em Rust e a camada de persistencia SQLite, estabelecendo o nucleo do sistema que todas as features futuras consumirao.

---

## Contexto

No Mailspring atual, os modelos vivem em `app/src/flux/models/` (25 arquivos TypeScript) e o banco e SQLite acessado via `better-sqlite3` no processo Electron (somente leitura — escrita exclusiva do sync engine C++).

No Open Mail, **o Rust e o unico que le e escreve no banco**. O frontend acessa dados exclusivamente via Tauri commands (IPC). Isso simplifica drasticamente o modelo de concorrencia e elimina a necessidade de "observable database" no frontend.

---

## Mapeamento de Modelos: Mailspring -> Open Mail

| Mailspring (`flux/models/`)          | Open Mail (`domain/models/`)    | Prioridade |
|--------------------------------------|---------------------------------|------------|
| `account.ts`                         | `account.rs`                    | P0         |
| `thread.ts`                          | `thread.rs`                     | P0         |
| `message.ts`                         | `message.rs`                    | P0         |
| `contact.ts`                         | `contact.rs`                    | P0         |
| `folder.ts` + `label.ts`            | `folder.rs` + `label.rs`       | P0         |
| `file.ts` (attachments)             | `attachment.rs`                 | P0         |
| `draft.ts` (subset de Message)       | Trait em `message.rs`           | P1         |
| `event.ts` + `calendar.ts`          | `event.rs`                      | P2         |
| `category.ts`                        | Unificado em `folder.rs`        | P0         |
| `query.ts` + `query-subscription.ts`| Nao existe — queries via commands| —          |
| `model-with-metadata.ts`            | Trait `HasMetadata`             | P1         |

---

## Entregaveis

### 1.1 — Modelos de Dominio Core (P0)

**Referencia Mailspring:** `app/src/flux/models/account.ts`, `thread.ts`, `message.ts`, `contact.ts`, `folder.ts`, `label.ts`, `file.ts`

**O que implementar em Rust:**

```rust
// src-tauri/src/domain/models/account.rs
pub struct Account {
    pub id: String,
    pub name: String,
    pub email_address: String,
    pub provider: AccountProvider,
    pub connection_settings: ConnectionSettings,
    pub sync_state: SyncState,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub enum AccountProvider {
    Gmail,
    Outlook,
    Yahoo,
    Imap,     // generico
    Exchange,
}

pub struct ConnectionSettings {
    pub imap_host: String,
    pub imap_port: u16,
    pub imap_security: SecurityType,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: SecurityType,
}

pub enum SecurityType {
    Ssl,
    StartTls,
    None,
}

pub enum SyncState {
    NotStarted,
    Running,
    Sleeping,
    Error(String),
}
```

```rust
// src-tauri/src/domain/models/thread.rs
pub struct Thread {
    pub id: String,
    pub account_id: String,
    pub subject: String,
    pub snippet: String,
    pub message_count: u32,
    pub participant_ids: Vec<String>,
    pub folder_ids: Vec<String>,
    pub label_ids: Vec<String>,
    pub has_attachments: bool,
    pub is_unread: bool,
    pub is_starred: bool,
    pub last_message_at: DateTime<Utc>,
    pub last_message_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

```rust
// src-tauri/src/domain/models/message.rs
pub struct Message {
    pub id: String,
    pub account_id: String,
    pub thread_id: String,
    pub from: Vec<Contact>,
    pub to: Vec<Contact>,
    pub cc: Vec<Contact>,
    pub bcc: Vec<Contact>,
    pub reply_to: Vec<Contact>,
    pub subject: String,
    pub snippet: String,
    pub body: String,             // HTML sanitizado
    pub plain_text: Option<String>,
    pub message_id_header: String,
    pub in_reply_to: Option<String>,
    pub references: Vec<String>,
    pub folder_id: String,
    pub label_ids: Vec<String>,
    pub is_unread: bool,
    pub is_starred: bool,
    pub is_draft: bool,
    pub date: DateTime<Utc>,
    pub attachments: Vec<Attachment>,
    pub headers: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

```rust
// src-tauri/src/domain/models/contact.rs
pub struct Contact {
    pub id: String,
    pub account_id: String,
    pub name: Option<String>,
    pub email: String,
    pub is_me: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

```rust
// src-tauri/src/domain/models/folder.rs
pub struct Folder {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub path: String,           // IMAP path completo
    pub role: Option<FolderRole>,
    pub unread_count: u32,
    pub total_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub enum FolderRole {
    Inbox,
    Sent,
    Drafts,
    Trash,
    Spam,
    Archive,
    All,
    Starred,
    Important,
}
```

```rust
// src-tauri/src/domain/models/label.rs
pub struct Label {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub display_name: String,
    pub color: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

```rust
// src-tauri/src/domain/models/attachment.rs
pub struct Attachment {
    pub id: String,
    pub message_id: String,
    pub filename: String,
    pub content_type: String,
    pub size: u64,
    pub content_id: Option<String>,  // para inline images
    pub is_inline: bool,
    pub local_path: Option<PathBuf>, // caminho local do cache
}
```

**Regras de dominio a implementar:**
- `Account::validate()` — valida settings de conexao
- `Thread::update_from_messages(msgs)` — recalcula snippet, counts, flags
- `Message::is_reply()` — verifica se e resposta (via in_reply_to/references)
- `Contact::display_name()` — retorna nome ou email como fallback
- `Folder::is_system_folder()` — identifica folders especiais

**Testes:**
- Unit test para cada modelo (criacao, validacao, serializacao)
- Teste de regras de dominio (Thread recalcula ao adicionar message)
- Teste de serializacao JSON (serde) para cada modelo

**Criterio de aceite:**
- [ ] Todos os 7 modelos P0 implementados com tipos fortes
- [ ] Serde Serialize/Deserialize em todos os modelos
- [ ] Display trait implementado para enums
- [ ] Testes unitarios passando (minimo 90% cobertura nos models)
- [ ] `cargo clippy` sem warnings

---

### 1.2 — Domain Errors & Events

**O que implementar:**

```rust
// src-tauri/src/domain/errors.rs
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Entity not found: {entity_type} with id {id}")]
    NotFound { entity_type: String, id: String },

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Duplicate entity: {0}")]
    Duplicate(String),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Sync error: {0}")]
    Sync(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

// Converter DomainError para erro serializavel do Tauri
impl serde::Serialize for DomainError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where S: serde::Serializer {
        serializer.serialize_str(&self.to_string())
    }
}
```

```rust
// src-tauri/src/domain/events.rs
#[derive(Clone, Debug, Serialize)]
pub enum DomainEvent {
    ThreadsChanged { account_id: String, thread_ids: Vec<String> },
    MessagesChanged { account_id: String, message_ids: Vec<String> },
    FoldersChanged { account_id: String },
    LabelsChanged { account_id: String },
    ContactsChanged { account_id: String },
    SyncStatusChanged { account_id: String, state: SyncState },
    AccountAdded { account_id: String },
    AccountRemoved { account_id: String },
}
```

**Criterio de aceite:**
- [ ] Todos os erros de dominio mapeados
- [ ] Eventos de dominio cobrem todas as mutacoes
- [ ] `DomainError` funciona como retorno de Tauri commands

---

### 1.3 — Repository Traits (Ports)

**Padrão:** Repository Pattern (Clean Architecture — ports)

O dominio define **traits** (interfaces). A infraestrutura implementa.

```rust
// src-tauri/src/domain/repositories.rs
use async_trait::async_trait;

#[async_trait]
pub trait ThreadRepository: Send + Sync {
    async fn find_by_id(&self, id: &str) -> Result<Option<Thread>, DomainError>;
    async fn find_by_folder(
        &self,
        account_id: &str,
        folder_id: &str,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<Thread>, DomainError>;
    async fn find_unread(&self, account_id: &str) -> Result<Vec<Thread>, DomainError>;
    async fn find_starred(&self, account_id: &str) -> Result<Vec<Thread>, DomainError>;
    async fn search(&self, account_id: &str, query: &str) -> Result<Vec<Thread>, DomainError>;
    async fn save(&self, thread: &Thread) -> Result<(), DomainError>;
    async fn save_batch(&self, threads: &[Thread]) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
    async fn count_by_folder(&self, account_id: &str, folder_id: &str) -> Result<u32, DomainError>;
    async fn count_unread_by_folder(&self, account_id: &str, folder_id: &str) -> Result<u32, DomainError>;
}

#[async_trait]
pub trait MessageRepository: Send + Sync {
    async fn find_by_id(&self, id: &str) -> Result<Option<Message>, DomainError>;
    async fn find_by_thread(&self, thread_id: &str) -> Result<Vec<Message>, DomainError>;
    async fn find_drafts(&self, account_id: &str) -> Result<Vec<Message>, DomainError>;
    async fn save(&self, message: &Message) -> Result<(), DomainError>;
    async fn save_batch(&self, messages: &[Message]) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
}

#[async_trait]
pub trait AccountRepository: Send + Sync {
    async fn find_all(&self) -> Result<Vec<Account>, DomainError>;
    async fn find_by_id(&self, id: &str) -> Result<Option<Account>, DomainError>;
    async fn save(&self, account: &Account) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
}

#[async_trait]
pub trait FolderRepository: Send + Sync {
    async fn find_by_account(&self, account_id: &str) -> Result<Vec<Folder>, DomainError>;
    async fn find_by_id(&self, id: &str) -> Result<Option<Folder>, DomainError>;
    async fn find_by_role(&self, account_id: &str, role: FolderRole) -> Result<Option<Folder>, DomainError>;
    async fn save(&self, folder: &Folder) -> Result<(), DomainError>;
    async fn save_batch(&self, folders: &[Folder]) -> Result<(), DomainError>;
    async fn delete(&self, id: &str) -> Result<(), DomainError>;
}

#[async_trait]
pub trait ContactRepository: Send + Sync {
    async fn find_by_email(&self, email: &str) -> Result<Option<Contact>, DomainError>;
    async fn find_by_account(&self, account_id: &str) -> Result<Vec<Contact>, DomainError>;
    async fn search(&self, query: &str, limit: u32) -> Result<Vec<Contact>, DomainError>;
    async fn save(&self, contact: &Contact) -> Result<(), DomainError>;
    async fn save_batch(&self, contacts: &[Contact]) -> Result<(), DomainError>;
}
```

**Criterio de aceite:**
- [ ] Todos os traits de repositorio definidos
- [ ] Traits sao async + Send + Sync
- [ ] Nenhuma dependencia de infra no modulo de dominio
- [ ] Documentacao em cada metodo do trait

---

### 1.4 — SQLite Database Setup (Infrastructure)

**O que implementar:**

```rust
// src-tauri/src/infrastructure/database/mod.rs
pub struct Database {
    pool: Pool<SqliteConnectionManager>,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, DomainError> { ... }
    pub fn run_migrations(&self) -> Result<(), DomainError> { ... }
    pub fn connection(&self) -> Result<Connection, DomainError> { ... }
}
```

**Migrations (SQL):**

```sql
-- migrations/001_initial_schema.sql

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email_address TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    connection_settings_json TEXT NOT NULL,
    sync_state TEXT NOT NULL DEFAULT 'not_started',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    role TEXT,
    unread_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_folders_account ON folders(account_id);
CREATE INDEX idx_folders_role ON folders(account_id, role);

CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_labels_account ON labels(account_id);

CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    snippet TEXT NOT NULL DEFAULT '',
    message_count INTEGER NOT NULL DEFAULT 0,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    is_unread INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    last_message_at TEXT NOT NULL,
    last_message_sent_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_threads_account ON threads(account_id);
CREATE INDEX idx_threads_last_message ON threads(account_id, last_message_at DESC);
CREATE INDEX idx_threads_unread ON threads(account_id, is_unread) WHERE is_unread = 1;
CREATE INDEX idx_threads_starred ON threads(account_id, is_starred) WHERE is_starred = 1;

CREATE TABLE IF NOT EXISTS thread_folders (
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    PRIMARY KEY (thread_id, folder_id)
);
CREATE INDEX idx_thread_folders_folder ON thread_folders(folder_id);

CREATE TABLE IF NOT EXISTS thread_labels (
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (thread_id, label_id)
);
CREATE INDEX idx_thread_labels_label ON thread_labels(label_id);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL REFERENCES folders(id),
    subject TEXT NOT NULL,
    snippet TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    plain_text TEXT,
    from_json TEXT NOT NULL,
    to_json TEXT NOT NULL,
    cc_json TEXT NOT NULL DEFAULT '[]',
    bcc_json TEXT NOT NULL DEFAULT '[]',
    reply_to_json TEXT NOT NULL DEFAULT '[]',
    message_id_header TEXT NOT NULL,
    in_reply_to TEXT,
    references_json TEXT NOT NULL DEFAULT '[]',
    is_unread INTEGER NOT NULL DEFAULT 1,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_draft INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    headers_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_messages_thread ON messages(thread_id, date ASC);
CREATE INDEX idx_messages_account ON messages(account_id);
CREATE INDEX idx_messages_folder ON messages(folder_id);
CREATE INDEX idx_messages_draft ON messages(account_id, is_draft) WHERE is_draft = 1;
CREATE INDEX idx_messages_date ON messages(account_id, date DESC);

CREATE TABLE IF NOT EXISTS message_labels (
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, label_id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    content_id TEXT,
    is_inline INTEGER NOT NULL DEFAULT 0,
    local_path TEXT
);
CREATE INDEX idx_attachments_message ON attachments(message_id);

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT NOT NULL,
    is_me INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    subject, body, plain_text,
    content='messages',
    content_rowid='rowid'
);

-- Triggers para manter FTS sincronizado
CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, subject, body, plain_text)
    VALUES (new.rowid, new.subject, new.body, new.plain_text);
END;

CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, subject, body, plain_text)
    VALUES ('delete', old.rowid, old.subject, old.body, old.plain_text);
END;

CREATE TRIGGER messages_fts_update AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, subject, body, plain_text)
    VALUES ('delete', old.rowid, old.subject, old.body, old.plain_text);
    INSERT INTO messages_fts(rowid, subject, body, plain_text)
    VALUES (new.rowid, new.subject, new.body, new.plain_text);
END;

-- Metadata para sync state
CREATE TABLE IF NOT EXISTS sync_state (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    uid_validity INTEGER,
    last_uid INTEGER,
    last_sync_at TEXT,
    PRIMARY KEY (account_id, folder_id)
);
```

**Criterio de aceite:**
- [ ] Schema criado com todas as tabelas
- [ ] Migrations rodam automaticamente no startup
- [ ] Indices otimizados para queries mais comuns
- [ ] FTS5 configurado para busca full-text em mensagens
- [ ] Foreign keys com ON DELETE CASCADE
- [ ] WAL mode habilitado para performance

---

### 1.5 — Repository Implementations (SQLite)

**O que implementar:**

Implementar cada trait definido em 1.3 usando `rusqlite`:

```
src-tauri/src/infrastructure/database/repositories/
├── mod.rs
├── thread_repository.rs    # impl ThreadRepository
├── message_repository.rs   # impl MessageRepository
├── account_repository.rs   # impl AccountRepository
├── folder_repository.rs    # impl FolderRepository
├── contact_repository.rs   # impl ContactRepository
├── label_repository.rs     # impl LabelRepository
└── attachment_repository.rs # impl AttachmentRepository
```

**Padroes a seguir:**
- Usar prepared statements (evitar SQL injection)
- Transacoes para operacoes batch (`save_batch`)
- Mapeamento de rows via `rusqlite::Row` -> Domain Model
- Paginacao via `LIMIT/OFFSET` nas queries de listagem
- Erros convertidos para `DomainError`

**Testes de integracao:**
- Criar banco em memoria (`:memory:`) para testes
- Testar CRUD completo para cada repositorio
- Testar queries com filtros (unread, starred, by folder)
- Testar paginacao
- Testar cascade delete (deletar account remove threads, messages, etc.)
- Testar FTS search

**Criterio de aceite:**
- [ ] Todos os 7 repositorios implementados
- [ ] Testes de integracao passando para cada repositorio
- [ ] Queries usando prepared statements
- [ ] Batch operations usando transacoes
- [ ] Performance: insert de 1000 messages em <500ms

---

### 1.6 — Tauri Commands para Acesso a Dados

**O que implementar:**

Expor os repositorios como Tauri commands para o frontend consumir:

```rust
// src-tauri/src/commands/threads.rs

#[tauri::command]
pub async fn list_threads(
    state: State<'_, AppState>,
    account_id: String,
    folder_id: String,
    offset: u32,
    limit: u32,
) -> Result<Vec<Thread>, DomainError> {
    state.thread_repo.find_by_folder(&account_id, &folder_id, offset, limit).await
}

#[tauri::command]
pub async fn get_thread(
    state: State<'_, AppState>,
    thread_id: String,
) -> Result<Option<Thread>, DomainError> {
    state.thread_repo.find_by_id(&thread_id).await
}

#[tauri::command]
pub async fn search_threads(
    state: State<'_, AppState>,
    account_id: String,
    query: String,
) -> Result<Vec<Thread>, DomainError> {
    state.thread_repo.search(&account_id, &query).await
}
```

**Commands a implementar:**

| Command                  | Params                              | Retorno             |
|--------------------------|-------------------------------------|---------------------|
| `list_accounts`          | —                                   | `Vec<Account>`      |
| `get_account`            | `account_id`                        | `Option<Account>`   |
| `list_folders`           | `account_id`                        | `Vec<Folder>`       |
| `list_labels`            | `account_id`                        | `Vec<Label>`        |
| `list_threads`           | `account_id, folder_id, offset, limit` | `Vec<Thread>`    |
| `get_thread`             | `thread_id`                         | `Option<Thread>`    |
| `list_messages`          | `thread_id`                         | `Vec<Message>`      |
| `get_message`            | `message_id`                        | `Option<Message>`   |
| `search_threads`         | `account_id, query`                 | `Vec<Thread>`       |
| `search_contacts`        | `query, limit`                      | `Vec<Contact>`      |
| `get_folder_counts`      | `account_id`                        | `Vec<FolderCount>`  |

**AppState:**

```rust
pub struct AppState {
    pub db: Database,
    pub thread_repo: Arc<dyn ThreadRepository>,
    pub message_repo: Arc<dyn MessageRepository>,
    pub account_repo: Arc<dyn AccountRepository>,
    pub folder_repo: Arc<dyn FolderRepository>,
    pub contact_repo: Arc<dyn ContactRepository>,
}
```

**Criterio de aceite:**
- [ ] Todos os commands registrados no Tauri builder
- [ ] Frontend consegue chamar cada command e receber dados tipados
- [ ] Erros propagados corretamente para o frontend
- [ ] State gerenciado via `tauri::State<AppState>`

---

### 1.7 — TypeScript Types (Frontend)

**O que implementar:**

Gerar tipos TypeScript correspondentes aos modelos Rust para o frontend:

```typescript
// src/lib/types.ts

export interface Account {
  id: string;
  name: string;
  emailAddress: string;
  provider: AccountProvider;
  syncState: SyncState;
  createdAt: string;
  updatedAt: string;
}

export type AccountProvider = 'gmail' | 'outlook' | 'yahoo' | 'imap' | 'exchange';
export type SyncState = 'not_started' | 'running' | 'sleeping' | { error: string };

export interface Thread {
  id: string;
  accountId: string;
  subject: string;
  snippet: string;
  messageCount: number;
  hasAttachments: boolean;
  isUnread: boolean;
  isStarred: boolean;
  lastMessageAt: string;
  lastMessageSentAt: string | null;
  folderIds: string[];
  labelIds: string[];
}

export interface Message {
  id: string;
  accountId: string;
  threadId: string;
  from: Contact[];
  to: Contact[];
  cc: Contact[];
  bcc: Contact[];
  replyTo: Contact[];
  subject: string;
  snippet: string;
  body: string;
  plainText: string | null;
  messageIdHeader: string;
  inReplyTo: string | null;
  references: string[];
  folderId: string;
  labelIds: string[];
  isUnread: boolean;
  isStarred: boolean;
  isDraft: boolean;
  date: string;
  attachments: Attachment[];
}

export interface Contact {
  id: string;
  accountId: string;
  name: string | null;
  email: string;
  isMe: boolean;
}

export interface Folder {
  id: string;
  accountId: string;
  name: string;
  path: string;
  role: FolderRole | null;
  unreadCount: number;
  totalCount: number;
}

export type FolderRole =
  | 'inbox' | 'sent' | 'drafts' | 'trash'
  | 'spam' | 'archive' | 'all' | 'starred' | 'important';

export interface Label {
  id: string;
  accountId: string;
  name: string;
  displayName: string;
  color: string | null;
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  size: number;
  contentId: string | null;
  isInline: boolean;
}
```

**Tauri invoke wrapper tipado:**

```typescript
// src/lib/tauri-bridge.ts
import { invoke } from '@tauri-apps/api/core';

export const api = {
  accounts: {
    list: () => invoke<Account[]>('list_accounts'),
    get: (id: string) => invoke<Account | null>('get_account', { accountId: id }),
  },
  folders: {
    list: (accountId: string) => invoke<Folder[]>('list_folders', { accountId }),
  },
  threads: {
    list: (accountId: string, folderId: string, offset: number, limit: number) =>
      invoke<Thread[]>('list_threads', { accountId, folderId, offset, limit }),
    get: (id: string) => invoke<Thread | null>('get_thread', { threadId: id }),
    search: (accountId: string, query: string) =>
      invoke<Thread[]>('search_threads', { accountId, query }),
  },
  messages: {
    list: (threadId: string) => invoke<Message[]>('list_messages', { threadId }),
    get: (id: string) => invoke<Message | null>('get_message', { messageId: id }),
  },
  contacts: {
    search: (query: string, limit: number) =>
      invoke<Contact[]>('search_contacts', { query, limit }),
  },
};
```

**Criterio de aceite:**
- [ ] Tipos TS correspondem 1:1 aos modelos Rust (snake_case -> camelCase)
- [ ] `tauri-bridge.ts` tipado para todos os commands
- [ ] Frontend compila sem erros de tipo
- [ ] Considerar uso de `ts-rs` crate para gerar tipos automaticamente

---

## Testes desta Fase

| Tipo        | Escopo                                        | Ferramenta   |
|-------------|-----------------------------------------------|--------------|
| Unit        | Modelos de dominio (validacao, regras)         | `cargo test` |
| Unit        | Serializacao/desserializacao (serde)           | `cargo test` |
| Integracao  | Repositorios SQLite (CRUD, queries, FTS)       | `cargo test` |
| Integracao  | Tauri commands (chamada IPC end-to-end)        | Manual/Vitest|
| Unit        | Tipos TypeScript (type-checking)               | `tsc`        |

---

## Checklist Final da Fase 1

- [ ] 7 modelos de dominio implementados em Rust com tipos fortes
- [ ] Erros de dominio centralizados com `thiserror`
- [ ] Eventos de dominio definidos
- [ ] Repository traits definidos (ports)
- [ ] Schema SQLite com migrations automaticas
- [ ] FTS5 para busca full-text
- [ ] 7 repositorios implementados (adapters)
- [ ] Tauri commands expostos para todos os CRUDs
- [ ] Tipos TypeScript sincronizados com Rust
- [ ] `tauri-bridge.ts` com API tipada
- [ ] Testes unitarios + integracao passando
- [ ] `cargo clippy` + `cargo fmt` sem issues
- [ ] CI green

---

**Fase anterior:** [Fase 0 — Fundacao & Setup](./fase_0.md)
**Proxima fase:** [Fase 2 — Sync Engine](./fase_2.md)
