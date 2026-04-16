# Open Mail — Roadmap de Reescrita com Tauri

## Visao Geral

Reescrita completa do **Mailspring** (Electron + C++) como **Open Mail** — um cliente de email desktop moderno, leve e extensivel, usando **Tauri v2** (Rust backend + Web frontend).

---

## Por que reescrever?

| Problema Atual (Mailspring)                | Solucao (Open Mail)                          |
|--------------------------------------------|----------------------------------------------|
| Electron consome ~300-500MB RAM            | Tauri usa webview nativa (~50-80MB RAM)      |
| Sync engine em C++ — dificil de manter     | Sync engine em Rust — seguro e performatico  |
| React 16.9 + Reflux (legado)              | React 19 + Zustand (moderno)                 |
| LESS + CSS inline                          | TailwindCSS v4                               |
| Jasmine (descontinuado)                    | Vitest + Playwright                          |
| Plugin system acoplado ao Electron         | Plugin system com WASM sandboxing            |
| SQLite via better-sqlite3 (JS binding)     | SQLite via rusqlite (nativo Rust)            |
| Slate editor (forks abandonados)           | TipTap v2 (ProseMirror, ativo)              |
| Sem sandboxing de plugins                  | Plugins isolados com permissions             |
| Build com Grunt (obsoleto)                 | Vite + cargo (moderno)                       |

---

## Arquitetura Alvo

```
┌─────────────────────────────────────────────────────────┐
│                     Open Mail (Tauri v2)                 │
├─────────────────────┬───────────────────────────────────┤
│   Frontend (Web)    │         Backend (Rust)             │
│                     │                                    │
│  React 19 + TS      │  Tauri Commands (IPC)              │
│  Zustand (state)    │  Sync Engine (IMAP/SMTP/JMAP)     │
│  TailwindCSS v4     │  rusqlite (SQLite)                │
│  TipTap v2 (editor) │  Plugin Host (WASM runtime)       │
│  Vitest (testes)    │  Notification Service              │
│  Lucide (icones)    │  Crypto / Keychain                │
│                     │  Search (tantivy)                  │
└─────────────────────┴───────────────────────────────────┘
```

### Comunicacao Frontend <-> Backend

```
Frontend (React)                    Backend (Rust)
     │                                    │
     │── invoke("list_threads") ─────────>│
     │<── Result<Vec<Thread>> ────────────│
     │                                    │
     │── invoke("send_draft") ───────────>│
     │<── Result<()> ─────────────────────│
     │                                    │
     │<── event("db:changed") ────────────│  (push reativo)
     │<── event("sync:status") ───────────│
     │<── event("notification:new") ──────│
```

---

## Stack Tecnica

### Frontend
| Tecnologia       | Proposito                    | Substitui                  |
|------------------|------------------------------|----------------------------|
| React 19         | UI framework                 | React 16.9                 |
| TypeScript 5.x   | Tipagem                      | TypeScript 5.7             |
| Zustand          | State management             | Reflux + RxJS Lite         |
| TailwindCSS v4   | Estilizacao                  | LESS                       |
| TipTap v2        | Rich text editor             | Slate (forks)              |
| Lucide React     | Icones                       | Imagens PNG/SVG avulsas    |
| Vitest           | Unit/integration tests       | Jasmine                    |
| Playwright       | E2E tests                    | (nao existia)              |
| Vite             | Build & dev server           | Grunt + custom scripts     |
| React Router v7  | Navegacao                    | Custom sheet system        |
| Framer Motion    | Animacoes premium            | (nao existia)              |
| Radix UI         | Primitivos acessiveis        | (custom, fragil)           |
| cmdk             | Command Palette (Cmd+K)      | (nao existia)              |
| XState           | State machines (onboarding)  | (useState ad-hoc)          |
| Biome            | Linter + formatter (10x ESLint) | ESLint + Prettier       |

### Backend (Rust)
| Tecnologia       | Proposito                    | Substitui                  |
|------------------|------------------------------|----------------------------|
| Tauri v2         | Desktop runtime              | Electron                   |
| rusqlite         | Database                     | better-sqlite3             |
| async-imap       | IMAP sync                    | Mailcore2 (C++)            |
| lettre           | SMTP envio                   | Mailcore2 (C++)            |
| tantivy          | Full-text search             | SQLite FTS                 |
| serde            | Serialization                | JSON manual                |
| tokio            | Async runtime                | Node.js event loop         |
| tauri-plugin-*   | OS integration               | Electron APIs              |
| wasmtime         | Plugin sandboxing            | (sem sandbox)              |
| keyring          | Credential storage           | Custom keychain            |
| ts-rs            | TypeScript type generation   | (manual, fragil)           |
| sea-query        | SQL builder type-safe        | (strings raw)              |
| refinery         | Database migrations          | (SQL inline)               |
| tracing          | Structured logging + spans   | log crate (flat)           |
| proptest         | Property-based testing       | (nao existia)              |
| tokio-util       | CancellationToken, shutdown  | (nao existia)              |

---

## Fases do Projeto

| Fase | Nome                              | Duracao Estimada | Arquivo          |
|------|-----------------------------------|------------------|------------------|
| 0    | Fundacao & Setup do Projeto       | 2 semanas        | `fase_0.md`      |
| 1    | Domain Models & Database (Rust)   | 3 semanas        | `fase_1.md`      |
| 2    | Sync Engine (IMAP/SMTP)           | 4 semanas        | `fase_2.md`      |
| 3    | UI Shell & Layout System          | 3 semanas        | `fase_3.md`      |
| 4    | Thread List & Message View        | 3 semanas        | `fase_4.md`      |
| 5    | Composer & Rich Text Editor       | 3 semanas        | `fase_5.md`      |
| 6    | Account Management & Onboarding   | 2 semanas        | `fase_6.md`      |
| 7    | Features Avancadas                | 4 semanas        | `fase_7.md`      |
| 8    | Plugin System v2                  | 3 semanas        | `fase_8.md`      |
| 9    | Polish, Performance & Release     | 3 semanas        | `fase_9.md`      |
| **Total** |                              | **~30 semanas**  |                  |

---

## Mapeamento: Mailspring -> Open Mail

### Modulos Core

| Mailspring                          | Open Mail                              |
|-------------------------------------|----------------------------------------|
| `app/src/browser/` (main process)   | `src-tauri/src/` (Rust backend)        |
| `app/src/flux/models/`              | `src-tauri/src/domain/models/`         |
| `app/src/flux/stores/`              | Frontend: Zustand stores               |
| `app/src/flux/tasks/`              | `src-tauri/src/domain/tasks/`          |
| `app/src/flux/actions.ts`          | Tauri events + Zustand actions         |
| `app/src/components/`              | `src/components/` (React 19)           |
| `app/src/registries/`             | `src/plugins/registry.ts`             |
| `app/src/services/`               | `src-tauri/src/services/`             |
| `mailsync` (C++ binary)            | `src-tauri/src/sync/` (Rust)          |

### Plugins Internos (48 packages)

| Categoria      | Packages Mailspring                                     | Abordagem Open Mail                     |
|---------------|--------------------------------------------------------|------------------------------------------|
| **Core UI**   | thread-list, message-list, composer, account-sidebar   | Modulos built-in do frontend             |
| **Composer**  | composer-signature, composer-templates, composer-grammar | Features do modulo Composer              |
| **Tracking**  | link-tracking, open-tracking, read-receipts            | Plugin Rust + UI components              |
| **Scheduling**| send-later, thread-snooze, send-reminders              | Tauri background tasks + UI              |
| **Temas**     | ui-dark, ui-light, ui-taiga, ui-darkside, etc.         | Temas TailwindCSS (CSS variables)        |
| **Seguranca** | phishing-detection, remove-tracking-pixels             | Rust sanitization + UI indicators        |
| **Outros**    | translation, contacts, calendar, print                  | Modulos independentes                    |

---

## Principios Arquiteturais

1. **Clean Architecture** — Dominio nao conhece framework. Rust backend e puro dominio.
2. **DDD** — Bounded contexts claros: Sync, Compose, Contacts, Calendar, Search.
3. **Offline-first** — SQLite local como source of truth. Sync em background.
4. **Event-driven** — Backend emite eventos, frontend reage. Sem polling.
5. **Security by default** — Credenciais no keychain do OS. Plugins sandboxed.
6. **Incremental delivery** — Cada fase entrega valor funcional testavel.
7. **Linux-first** — XDG compliance, Wayland-first, Flatpak tier 1, GTK theme sync.
8. **Premium UX** — Motion design, glass morphism, depth system, typography scale (Spark Mail reference).
9. **Type safety end-to-end** — Newtype IDs, ts-rs auto-generation, sea-query, CQRS read models.

---

## Riscos e Mitigacoes

| Risco                                    | Impacto | Mitigacao                                      |
|------------------------------------------|---------|------------------------------------------------|
| Complexidade IMAP (RFCs)                 | Alto    | Usar crates maduros (async-imap, imap-codec)   |
| Paridade de features com Mailspring      | Medio   | Priorizar 80/20 — features mais usadas primeiro |
| TipTap vs Slate migration                | Medio   | Reescrever composer do zero com TipTap          |
| Plugin backward compatibility            | Baixo   | Nao manter compat — novo sistema WASM           |
| Tauri webview inconsistencies (Linux)    | Medio   | Testes E2E em todas plataformas via CI          |
| OAuth2 flow em Tauri                     | Medio   | tauri-plugin-oauth ou deep links                |

---

## Estrutura de Diretorios Alvo

```
open-mail/
├── src-tauri/
│   ├── Cargo.toml              # [workspace] — ver guia_rust_pro.md §1
│   ├── tauri.conf.json
│   ├── capabilities/
│   ├── icons/
│   ├── crates/                  # Cargo workspace (Clean Architecture)
│   │   ├── openmail-core/       # Domain: models, traits, errors, events
│   │   │   └── src/
│   │   │       ├── models/      # Newtype IDs, Value Objects, Rich Models
│   │   │       │   ├── ids.rs           # AccountId, ThreadId, etc.
│   │   │       │   ├── value_objects.rs  # EmailAddress, Subject, Snippet
│   │   │       │   ├── account.rs
│   │   │       │   ├── thread.rs
│   │   │       │   ├── message.rs
│   │   │       │   ├── message_builder.rs
│   │   │       │   ├── contact.rs
│   │   │       │   ├── folder.rs
│   │   │       │   ├── label.rs
│   │   │       │   └── attachment.rs
│   │   │       ├── read_models.rs  # CQRS-lite: ThreadSummary, MessageDetail
│   │   │       ├── events.rs
│   │   │       ├── errors.rs
│   │   │       ├── ports.rs       # Repository traits (ports)
│   │   │       └── paths.rs       # XDG-compliant app paths
│   │   ├── openmail-db/         # Infra: SQLite, repositories, migrations
│   │   │   └── src/
│   │   │       ├── schema.rs      # sea-query Iden definitions
│   │   │       ├── migrations/    # refinery versioned migrations
│   │   │       ├── repositories/  # Trait implementations (adapters)
│   │   │       └── queries/       # Optimized read model queries
│   │   ├── openmail-sync/       # Infra: IMAP, SMTP, OAuth, workers
│   │   │   └── src/
│   │   │       ├── actor.rs       # SyncActor with tokio::mpsc
│   │   │       ├── imap_client.rs
│   │   │       ├── smtp_client.rs
│   │   │       ├── delta_sync.rs  # CONDSTORE/QRESYNC
│   │   │       ├── circuit_breaker.rs
│   │   │       ├── outbox.rs      # Persistent task queue
│   │   │       ├── oauth.rs
│   │   │       └── threading.rs
│   │   ├── openmail-search/     # Infra: Tantivy full-text search
│   │   │   └── src/
│   │   └── openmail-plugins/    # Infra: WASM host, plugin lifecycle
│   │       └── src/
│   └── src/
│       ├── main.rs              # Entry point + graceful shutdown
│       ├── lib.rs               # Tauri setup, tracing, command registration
│       └── commands/            # Thin Tauri command handlers (no logic)
├── src/                        # Frontend (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/                # Componentes base (shadcn-like)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SheetContainer.tsx
│   │   │   └── Toolbar.tsx
│   │   ├── thread-list/
│   │   ├── message-list/
│   │   ├── composer/
│   │   ├── contacts/
│   │   ├── calendar/
│   │   └── preferences/
│   ├── stores/                # Zustand stores
│   │   ├── useAccountStore.ts
│   │   ├── useThreadStore.ts
│   │   ├── useMessageStore.ts
│   │   ├── useDraftStore.ts
│   │   └── useUIStore.ts
│   ├── hooks/                 # Custom hooks
│   │   ├── useTauriEvent.ts
│   │   ├── useInvoke.ts
│   │   └── useSearch.ts
│   ├── lib/                   # Utilities
│   │   ├── tauri-bridge.ts
│   │   ├── date-utils.ts
│   │   └── sanitize.ts
│   ├── plugins/               # Plugin registry frontend
│   │   └── registry.ts
│   └── styles/
│       └── globals.css
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Criterio de Sucesso por Fase

Cada fase deve entregar:

1. **Codigo funcionando** — build green, sem erros
2. **Testes passando** — cobertura minima de 80% no dominio
3. **Demo funcional** — feature visivel/testavel pelo usuario
4. **Documentacao** — decisoes arquiteturais registradas
5. **CI green** — lint + typecheck + testes automatizados

---

## Guias de Melhorias & Implementação

Documentos complementares que elevam o roadmap original com padrões avançados, exemplos de código e decisões de design:

| Guia | Conteúdo | Impacto |
|------|----------|---------|
| [`analise_melhorias.md`](./analise_melhorias.md) | Índice mestre de todas as melhorias identificadas por fase | Visão geral |
| [`guia_rust_pro.md`](./guia_rust_pro.md) | 16 padrões Rust avançados: Newtype IDs, Value Objects, Rich Domain, CQRS-lite, Actor Model, Circuit Breaker, Outbox Pattern, tracing, property testing | Qualidade e robustez do backend |
| [`guia_react_pro.md`](./guia_react_pro.md) | 13 padrões React: Command Palette, Radix UI, View Transitions, Suspense, Swipe Gestures, Shadow DOM, Slash Commands, XState, Smart Recipients | UX premium e performance |
| [`guia_design_luxo.md`](./guia_design_luxo.md) | Design system Spark-like: Framer Motion, Glass Morphism, Depth System, Typography Scale, OKLCH colors, Skeleton Shimmer, Avatar Gradients, Composer Modal | Estética premium (Spark Mail reference) |
| [`guia_linux_first.md`](./guia_linux_first.md) | Linux como cidadão de primeira classe: XDG, Wayland-first, GTK theme sync, Flatpak tier 1, AppStream, System Tray, Mailto handler | Adoção pela comunidade Linux |

### Priorização das Melhorias

**Tier 1 — Fundacional (antes de qualquer fase):**
- Newtype IDs, Value Objects, Rich Domain Models
- ts-rs (geração automática de tipos TS ↔ Rust)
- Tracing desde o dia 1
- XDG compliance

**Tier 2 — Diferencial Competitivo (fases 3-5):**
- Framer Motion, Glass Morphism, Command Palette
- Avatar Gradients, Composer Modal animado
- Onboarding Premium

**Tier 3 — Excelência Técnica (fases 6-9):**
- Actor Model para sync, Outbox Pattern, CQRS-lite
- Flatpak tier 1, Wayland-first, GTK theme sync

---

## Proximo Passo

Iniciar pela **[Fase 0 — Fundacao & Setup](./fase_0.md)** e consultar os guias de melhorias para cada fase.
