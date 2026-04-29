# Fase 6 — Account Management & Onboarding

**Duracao estimada:** 2 semanas
**Dependencia:** Fase 2 (sync engine, OAuth2), Fase 3 (UI shell)
**Objetivo:** Implementar o fluxo de onboarding (adicionar conta pela primeira vez), gerenciamento de multiplas contas e tela de preferences. Ao final, o usuario consegue configurar contas de email e gerenciar preferencias do app.

---

## Contexto

No Mailspring, o onboarding e o plugin `internal_packages/onboarding/` (31 arquivos) com wizard multi-step. As preferences sao o plugin `internal_packages/preferences/` (25 arquivos) com abas para General, Accounts, Appearance, Shortcuts, etc.

No Open Mail, simplificamos o onboarding para um fluxo linear focado e as preferences para uma single-page com secoes.

---

## Entregaveis

### 6.1 — Onboarding Flow

**Referencia Mailspring:** `app/internal_packages/onboarding/` — `onboarding-root.tsx`, `page-account-settings.tsx`, `page-account-settings-imap.tsx`

**O que implementar:**

```
src/components/onboarding/
├── OnboardingLayout.tsx       # Layout sem shell (tela cheia)
├── WelcomeStep.tsx            # Boas vindas + escolha de provedor
├── OAuthStep.tsx              # Login via OAuth (Gmail, Outlook)
├── ImapStep.tsx               # Configuracao manual IMAP/SMTP
├── TestConnectionStep.tsx     # Testar conexao
├── SyncStep.tsx               # Sync inicial (progress)
├── DoneStep.tsx               # Sucesso
└── ProviderCard.tsx           # Card de provedor (Gmail, Outlook, etc.)
```

**Fluxo:**

```
[Welcome] → [Select Provider] → [Auth] → [Test Connection] → [Initial Sync] → [Done]
                                   │
                    ┌──────────────┼──────────────┐
                    │              │               │
                 [OAuth]      [IMAP Manual]    [Exchange]
                 (Gmail,      (host, port,     (autodiscover)
                  Outlook)     user, pass)
```

**Step 1 — Welcome:**
- Logo do Open Mail
- "Welcome to Open Mail"
- "Add your first email account to get started"
- Botao "Get Started"

**Step 2 — Select Provider:**

```
┌──────────────────────────────────────────────┐
│         Add your email account                │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │  Gmail   │  │ Outlook │  │  Yahoo  │      │
│  │  [icon]  │  │  [icon] │  │  [icon] │      │
│  └─────────┘  └─────────┘  └─────────┘      │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ iCloud  │  │Fastmail │  │  Other  │      │
│  │  [icon]  │  │  [icon] │  │ (IMAP)  │      │
│  └─────────┘  └─────────┘  └─────────┘      │
│                                               │
└──────────────────────────────────────────────┘
```

Provedores com OAuth: Gmail, Outlook
Provedores com autodiscover: Yahoo, iCloud, Fastmail
"Other" → formulario IMAP manual

**Step 3a — OAuth (Gmail/Outlook):**
1. Exibir explicacao do que sera acessado
2. Botao "Sign in with Google / Microsoft"
3. Abre browser do sistema para autorizacao
4. App captura callback via deep link (`openmail://oauth/callback`)
5. Troca code por tokens
6. Salva tokens no keychain
7. Auto-detecta IMAP/SMTP settings para o provedor

**Step 3b — IMAP Manual:**

```
┌──────────────────────────────────────────────┐
│         IMAP Server Settings                  │
│                                               │
│  Email:    [user@example.com               ]  │
│  Password: [••••••••••                     ]  │
│                                               │
│  ── Incoming Mail (IMAP) ──                   │
│  Server:   [imap.example.com               ]  │
│  Port:     [993          ]  Security: [SSL ▾] │
│                                               │
│  ── Outgoing Mail (SMTP) ──                   │
│  Server:   [smtp.example.com               ]  │
│  Port:     [587          ]  Security: [TLS ▾] │
│                                               │
│  [Back]                        [Test & Connect]│
└──────────────────────────────────────────────┘
```

**Autodiscover:**
Ao digitar email, tentar auto-detectar settings:
1. Verificar banco de provedores conhecidos (DNS MX record → settings)
2. Tentar autodiscover (RFC 6186 — SRV records)
3. Tentar well-known paths (`/.well-known/autoconfig/mail/config-v1.1.xml`)
4. Fallback para manual

**Tauri commands:**

```rust
#[tauri::command]
pub async fn autodiscover_settings(email: String) -> Result<Option<ConnectionSettings>, String>;

#[tauri::command]
pub async fn test_imap_connection(settings: ConnectionSettings, credentials: Credentials) -> Result<(), String>;

#[tauri::command]
pub async fn test_smtp_connection(settings: ConnectionSettings, credentials: Credentials) -> Result<(), String>;

#[tauri::command]
pub async fn add_account(
    state: State<'_, AppState>,
    name: String,
    email: String,
    provider: AccountProvider,
    settings: ConnectionSettings,
    credentials: Credentials,
) -> Result<Account, DomainError>;
```

**Step 4 — Test Connection:**
- Testar IMAP connection (spinner + status)
- Testar SMTP connection (spinner + status)
- Se falha, mostrar erro e permitir voltar para corrigir
- Se sucesso, prosseguir

**Step 5 — Initial Sync:**
- Barra de progresso: "Syncing inbox... (142/1500 messages)"
- Sync folders primeiro (rapido)
- Sync inbox (prioridade, mostrar progresso)
- Sync restante em background apos onboarding

**Step 6 — Done:**
- "You're all set!"
- "Your inbox is ready"
- Botao "Open Inbox"
- Opcao "Add another account"

**Criterio de aceite:**
- [ ] Fluxo completo funciona (provider → auth → test → sync → done)
- [ ] OAuth funciona com Gmail
- [ ] OAuth funciona com Outlook
- [x] IMAP manual funciona
- [x] Autodiscover funciona para provedores comuns
- [x] Test connection com feedback visual
- [x] Initial sync com progresso
- [ ] Credenciais salvas no keychain
- [x] Conta persitida no banco

> Status: o onboarding ja tem wizard real de ponta a ponta no frontend, o caminho `IMAP manual` testa `IMAP/SMTP` pelo backend Tauri, persiste conta/credenciais, faz `autodiscover` para provedores comuns ao digitar o email e usa progresso real do `sync status` no passo de `Initial sync` no desktop. O caminho `OAuth` tambem avanca alem da URL de autorizacao com captura manual do `authorization code` e persistencia local da conta no desktop. As credenciais agora sobrevivem ao restart do app em armazenamento local do runtime, mas ainda nao estao em `keychain` nativo; o que segue aberto neste bloco e mais pesado e especifico e justamente a troca live do code por tokens no provedor, `keychain` de verdade e o callback/deep-link real do OAuth.

---

### 6.2 — Adicionar Conta Adicional

**O que implementar:**

O mesmo fluxo de onboarding, mas acessivel via:
- Sidebar → botao "+" ao lado de "Accounts"
- Preferences → Accounts → "Add Account"

Diferenca: nao mostra tela de Welcome, vai direto para Select Provider.

**Criterio de aceite:**
- [x] Adicionar segunda conta funciona
- [x] Sidebar mostra ambas as contas
- [ ] Sync roda independente por conta
- [ ] Unified inbox mostra threads de todas as contas

> Status: o shell agora consegue abrir o onboarding como `Add account` sem a etapa de `Welcome`, e a sidebar passa a listar as contas configuradas no app depois que o fluxo termina. O que ainda fica aberto nesta frente e a navegacao/sync realmente independentes por conta e a visao unificada de inbox.

---

### 6.3 — Preferences

**Referencia Mailspring:** `app/internal_packages/preferences/` (25 arquivos)

**O que implementar:**

```
src/components/preferences/
├── PreferencesLayout.tsx       # Layout com sidebar de secoes
├── PreferencesGeneral.tsx      # Configuracoes gerais
├── PreferencesAccounts.tsx     # Gerenciamento de contas
├── PreferencesAppearance.tsx   # Tema, fonte, layout
├── PreferencesSignatures.tsx   # Assinaturas
├── PreferencesShortcuts.tsx    # Atalhos de teclado
├── PreferencesNotifications.tsx # Notificacoes
└── PreferencesAdvanced.tsx     # Avancado
```

**Layout:**

```
┌─────────────────────────────────────────────────┐
│  Preferences                              [✕]   │
├───────────────┬─────────────────────────────────┤
│               │                                  │
│  General      │  General Settings                │
│  Accounts     │                                  │
│  Appearance   │  Language: [English ▾]           │
│  Signatures   │  Default account: [leco@... ▾]   │
│  Shortcuts    │                                  │
│  Notifications│  Reading                         │
│  Advanced     │  ☑ Mark as read when opened      │
│               │  ☑ Show snippets in thread list  │
│               │  ☐ Auto-load remote images       │
│               │                                  │
│               │  Sending                         │
│               │  ☑ Include signature in replies   │
│               │  ☐ Request read receipts          │
│               │  Undo send delay: [5 seconds ▾]  │
│               │                                  │
│               │  Startup                         │
│               │  ☑ Launch at login                │
│               │  ☑ Check for updates              │
│               │                                  │
└───────────────┴─────────────────────────────────┘
```

**Secoes:**

#### General
- Idioma
- Conta padrao
- Comportamento de leitura (mark as read, snippets, images)
- Comportamento de envio (signature, read receipts, undo delay)
- Startup (launch at login, check for updates)

#### Accounts
- Lista de contas configuradas
- Editar conta (nome, settings)
- Remover conta (com confirmacao)
- Re-autenticar (OAuth refresh / change password)
- Adicionar nova conta

#### Appearance
- Tema (Light / Dark / System)
- Tamanho de fonte
- Layout (split / list)
- Densidade (comfortable / compact)
- Sidebar width reset

#### Signatures
- Reutilizar editor de assinatura da Fase 5
- CRUD de assinaturas
- Assinatura padrao por conta

#### Shortcuts
- Tabela de atalhos atuais
- Customizacao (futuro — nesta fase apenas visualizacao)
- Reset para padrao

#### Notifications
- Ativar/desativar notificacoes desktop
- Som de notificacao
- Notificar apenas para inbox (ou todos os folders)
- Horario de silencio

#### Advanced
- Caminho do banco de dados
- Limpar cache
- Exportar dados
- Importar dados
- Reset completo
- Developer tools toggle
- Log level

**Persistencia:**

```rust
// src-tauri/src/infrastructure/config.rs
pub struct AppConfig {
    pub language: String,
    pub default_account_id: Option<String>,
    pub mark_as_read_on_open: bool,
    pub show_snippets: bool,
    pub auto_load_images: bool,
    pub include_signature_in_replies: bool,
    pub undo_send_delay_seconds: u32,
    pub launch_at_login: bool,
    pub check_for_updates: bool,
    pub theme: String,
    pub font_size: u32,
    pub layout_mode: String,
    pub density: String,
    pub notifications_enabled: bool,
    pub notification_sound: bool,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
}
```

**Tauri commands:**

```rust
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, DomainError>;

#[tauri::command]
pub async fn update_config(state: State<'_, AppState>, config: AppConfig) -> Result<(), DomainError>;

#[tauri::command]
pub async fn remove_account(state: State<'_, AppState>, account_id: String) -> Result<(), DomainError>;

#[tauri::command]
pub async fn update_account(state: State<'_, AppState>, account: Account) -> Result<(), DomainError>;
```

**Criterio de aceite:**
- [ ] Todas as 7 secoes renderizam
- [ ] Mudancas aplicadas em tempo real (sem restart)
- [ ] Config persistida no backend
- [ ] Remover conta funciona (com confirmacao)
- [ ] Tema muda imediatamente
- [ ] Launch at login funciona (macOS, Linux, Windows)

---

### 6.4 — Notificacoes Desktop

**Referencia Mailspring:** `app/internal_packages/unread-notifications/`, `app/src/native-notifications.ts` (13KB)

**O que implementar:**

```rust
// src-tauri/src/services/notifications.rs
use tauri::notification::NotificationBuilder;

pub struct NotificationService;

impl NotificationService {
    pub fn notify_new_messages(
        app: &AppHandle,
        messages: &[Message],
        config: &AppConfig,
    ) -> Result<(), String> {
        if !config.notifications_enabled { return Ok(()); }
        if is_quiet_hours(config) { return Ok(()); }

        for message in messages.iter().take(3) {
            let sender = message.from.first()
                .map(|c| c.name.as_deref().unwrap_or(&c.email))
                .unwrap_or("Unknown");

            app.notification()
                .builder()
                .title(sender)
                .body(&message.snippet)
                .show()?;
        }

        if messages.len() > 3 {
            app.notification()
                .builder()
                .title("New messages")
                .body(&format!("and {} more", messages.len() - 3))
                .show()?;
        }

        Ok(())
    }
}
```

**Funcionalidades:**
- Notificacao nativa do OS ao receber novos emails
- Mostrar remetente + snippet
- Agrupar se muitos emails simultaneos
- Respeitar quiet hours
- Click na notificacao abre o email no app
- Badge no dock/taskbar com unread count

**Tauri plugins necessarios:**
```toml
[dependencies]
tauri-plugin-notification = "2"
```

**Criterio de aceite:**
- [ ] Notificacao desktop ao receber email novo
- [ ] Click na notificacao abre o app no email
- [ ] Quiet hours respeitado
- [ ] Badge de unread no dock (macOS)
- [ ] Configuravel em Preferences

---

### 6.5 — System Tray

**Referencia Mailspring:** `app/internal_packages/system-tray/` (7 arquivos)

**O que implementar:**

```rust
// Em lib.rs, setup do tray
use tauri::{
    tray::{TrayIconBuilder, MouseButton, MouseButtonState},
    menu::{Menu, MenuItem},
};

fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = Menu::with_items(app, &[
        &MenuItem::with_id(app, "open", "Open Open Mail", true, None::<&str>)?,
        &MenuItem::with_id(app, "compose", "New Message", true, Some("CmdOrCtrl+N"))?,
        &MenuItem::Separator,
        &MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?,
    ])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("Open Mail")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "open" => { /* focus window */ },
                "compose" => { /* open composer */ },
                "quit" => { app.exit(0); },
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
```

**Funcionalidades:**
- Icone na system tray
- Badge de unread count no icone (macOS)
- Menu: Open, New Message, Quit
- Click no icone abre/foca a janela
- Fechar janela minimiza para tray (configuravel)

**Criterio de aceite:**
- [ ] Icone na system tray
- [ ] Menu com acoes basicas
- [ ] Click abre/foca app
- [ ] Fechar minimiza para tray (se configurado)
- [ ] Unread badge no icone

---

## Testes desta Fase

| Tipo        | Escopo                                       | Ferramenta      |
|-------------|----------------------------------------------|-----------------|
| Unit        | Autodiscover (MX lookup, SRV records)         | `cargo test`    |
| Unit        | Config serialization/validation               | `cargo test`    |
| Integracao  | Test connection (IMAP + SMTP)                 | `cargo test`    |
| Integracao  | Add account flow (mock connections)           | Vitest          |
| E2E         | Onboarding: IMAP manual → inbox               | Playwright      |
| E2E         | Preferences: change theme                     | Playwright      |

---

## Checklist Final da Fase 6

- [ ] Onboarding flow completo (6 steps)
- [ ] OAuth2 funcional (Gmail, Outlook)
- [ ] IMAP manual funcional
- [ ] Autodiscover para provedores comuns
- [ ] Test connection com feedback
- [ ] Initial sync com progresso
- [ ] Adicionar conta adicional
- [ ] Preferences com 7 secoes
- [ ] Config persistida e aplicada em tempo real
- [ ] Remover conta funcional
- [ ] Notificacoes desktop
- [ ] System tray
- [ ] Launch at login
- [ ] Testes passando
- [ ] CI green

---

**Fase anterior:** [Fase 5 — Composer](./fase_5.md)
**Proxima fase:** [Fase 7 — Features Avancadas](./fase_7.md)
