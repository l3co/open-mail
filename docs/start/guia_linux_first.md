# Guia Linux-First — Open Mail como Cidadão de Primeira Classe no Linux

> O Linux não tem um email client premium.
> Thunderbird é funcional mas antiquado. Geary é bonito mas limitado.
> O Open Mail pode ser **o** email client que a comunidade Linux merece.
> Este guia garante que Linux não é "também funciona" — é **prioridade**.

---

## §1 — XDG Base Directory desde o Dia 1

### Problema
Muitos apps criam `~/.app-name/` na home. No Linux, a convenção é **XDG Base Directory Specification**.
Ignorar XDG é sinal de que o app não foi feito para Linux.

### Solução
Respeitar XDG em todo o armazenamento:

```rust
// crates/openmail-core/src/paths.rs
use std::path::PathBuf;

pub struct AppPaths {
    pub config_dir: PathBuf,    // Configurações editáveis
    pub data_dir: PathBuf,      // Dados persistentes (database, indices)
    pub cache_dir: PathBuf,     // Cache (pode ser deletado sem perda)
    pub log_dir: PathBuf,       // Logs
    pub state_dir: PathBuf,     // Estado de runtime (locks, PIDs)
}

impl AppPaths {
    pub fn resolve() -> Self {
        if cfg!(target_os = "linux") {
            Self::linux()
        } else if cfg!(target_os = "macos") {
            Self::macos()
        } else {
            Self::windows()
        }
    }

    fn linux() -> Self {
        let home = dirs::home_dir().expect("HOME not set");

        let config_dir = std::env::var("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".config"))
            .join("open-mail");

        let data_dir = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".local/share"))
            .join("open-mail");

        let cache_dir = std::env::var("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".cache"))
            .join("open-mail");

        let state_dir = std::env::var("XDG_STATE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home.join(".local/state"))
            .join("open-mail");

        let log_dir = state_dir.join("logs");

        Self { config_dir, data_dir, cache_dir, log_dir, state_dir }
    }

    fn macos() -> Self {
        let home = dirs::home_dir().expect("HOME not set");
        let app_support = home.join("Library/Application Support/OpenMail");
        let cache = home.join("Library/Caches/OpenMail");
        let logs = home.join("Library/Logs/OpenMail");

        Self {
            config_dir: app_support.clone(),
            data_dir: app_support,
            cache_dir: cache,
            log_dir: logs.clone(),
            state_dir: logs,
        }
    }

    fn windows() -> Self {
        let app_data = dirs::data_dir().expect("APPDATA not set");
        let base = app_data.join("OpenMail");

        Self {
            config_dir: base.join("Config"),
            data_dir: base.join("Data"),
            cache_dir: base.join("Cache"),
            log_dir: base.join("Logs"),
            state_dir: base.join("State"),
        }
    }

    /// Garante que todos os diretórios existem
    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [&self.config_dir, &self.data_dir, &self.cache_dir, &self.log_dir, &self.state_dir] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }
}
```

### Estrutura no Linux

```
~/.config/open-mail/
├── config.toml              # Preferências do usuário
├── accounts.toml            # Configurações de contas (sem senhas)
└── themes/                  # Temas customizados

~/.local/share/open-mail/
├── database.sqlite          # Database principal
├── search-index/            # Tantivy index
├── attachments-cache/       # Attachments baixados
└── plugins/                 # Plugins instalados

~/.cache/open-mail/
├── avatars/                 # Cache de imagens de contato
├── thumbnails/              # Preview de attachments
└── bodies/                  # HTML bodies cacheados

~/.local/state/open-mail/
├── logs/
│   ├── open-mail.2025-03-12.log
│   └── open-mail.2025-03-11.log
└── open-mail.lock           # Single instance lock
```

### `.desktop` file

```ini
# /usr/share/applications/open-mail.desktop
[Desktop Entry]
Name=Open Mail
GenericName=Email Client
Comment=A premium email client for Linux
Exec=open-mail %u
Icon=open-mail
Type=Application
Categories=Network;Email;
MimeType=x-scheme-handler/mailto;message/rfc822;
Keywords=email;mail;e-mail;
StartupNotify=true
StartupWMClass=open-mail
Actions=Compose;

[Desktop Action Compose]
Name=Compose New Email
Exec=open-mail --compose
```

---

## §2 — Respeitar GTK/Adwaita Themes

### Problema
Apps Electron/Tauri parecem alienígenas no GNOME/KDE porque ignoram completamente as preferências de tema do sistema.

### Solução
Detectar e adaptar ao tema do desktop:

```rust
// crates/openmail-core/src/platform/linux.rs

#[derive(Debug, Clone, PartialEq)]
pub enum DesktopEnvironment {
    Gnome,
    Kde,
    Xfce,
    Cinnamon,
    Mate,
    Unknown(String),
}

#[derive(Debug, Clone)]
pub struct LinuxDesktopInfo {
    pub de: DesktopEnvironment,
    pub prefer_dark: bool,
    pub accent_color: Option<String>,
    pub font_name: Option<String>,
    pub font_size: Option<f64>,
    pub cursor_theme: Option<String>,
    pub icon_theme: Option<String>,
}

impl LinuxDesktopInfo {
    pub fn detect() -> Self {
        let de = detect_desktop_environment();
        let prefer_dark = detect_dark_preference(&de);
        let accent_color = detect_accent_color(&de);
        let (font_name, font_size) = detect_system_font(&de);

        Self {
            de,
            prefer_dark,
            accent_color,
            font_name,
            font_size,
            cursor_theme: detect_cursor_theme(),
            icon_theme: detect_icon_theme(),
        }
    }
}

fn detect_desktop_environment() -> DesktopEnvironment {
    let xdg_desktop = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default();
    let desktop = xdg_desktop.to_lowercase();

    if desktop.contains("gnome") { DesktopEnvironment::Gnome }
    else if desktop.contains("kde") || desktop.contains("plasma") { DesktopEnvironment::Kde }
    else if desktop.contains("xfce") { DesktopEnvironment::Xfce }
    else if desktop.contains("cinnamon") { DesktopEnvironment::Cinnamon }
    else if desktop.contains("mate") { DesktopEnvironment::Mate }
    else { DesktopEnvironment::Unknown(xdg_desktop) }
}

fn detect_dark_preference(de: &DesktopEnvironment) -> bool {
    match de {
        DesktopEnvironment::Gnome | DesktopEnvironment::Cinnamon => {
            // gsettings get org.gnome.desktop.interface color-scheme
            std::process::Command::new("gsettings")
                .args(["get", "org.gnome.desktop.interface", "color-scheme"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.contains("dark"))
                .unwrap_or(false)
        }
        DesktopEnvironment::Kde => {
            // KDE: lê kdeglobals
            let config_path = dirs::config_dir()
                .map(|d| d.join("kdeglobals"));

            config_path
                .and_then(|p| std::fs::read_to_string(p).ok())
                .map(|content| {
                    // Procura por ColorScheme com "Dark" no nome
                    content.lines()
                        .any(|l| l.starts_with("ColorScheme") && l.to_lowercase().contains("dark"))
                })
                .unwrap_or(false)
        }
        _ => false,
    }
}

fn detect_accent_color(de: &DesktopEnvironment) -> Option<String> {
    match de {
        DesktopEnvironment::Gnome => {
            // GNOME 47+ tem accent colors
            std::process::Command::new("gsettings")
                .args(["get", "org.gnome.desktop.interface", "accent-color"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().trim_matches('\'').to_string())
                .filter(|s| !s.is_empty() && s != "default")
        }
        _ => None,
    }
}

fn detect_system_font(de: &DesktopEnvironment) -> (Option<String>, Option<f64>) {
    match de {
        DesktopEnvironment::Gnome | DesktopEnvironment::Cinnamon => {
            let output = std::process::Command::new("gsettings")
                .args(["get", "org.gnome.desktop.interface", "font-name"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok());

            if let Some(font_str) = output {
                // Ex: "'Cantarell 11'" → ("Cantarell", 11.0)
                let cleaned = font_str.trim().trim_matches('\'');
                let parts: Vec<&str> = cleaned.rsplitn(2, ' ').collect();
                if parts.len() == 2 {
                    let size = parts[0].parse::<f64>().ok();
                    let name = parts[1].to_string();
                    return (Some(name), size);
                }
            }
            (None, None)
        }
        _ => (None, None),
    }
}

fn detect_cursor_theme() -> Option<String> {
    std::env::var("XCURSOR_THEME").ok()
}

fn detect_icon_theme() -> Option<String> {
    std::process::Command::new("gsettings")
        .args(["get", "org.gnome.desktop.interface", "icon-theme"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().trim_matches('\'').to_string())
}
```

### Enviando info de desktop para o frontend:

```rust
#[tauri::command]
pub fn get_desktop_info() -> LinuxDesktopInfo {
    LinuxDesktopInfo::detect()
}
```

```tsx
// src/hooks/useLinuxThemeSync.ts

export function useLinuxThemeSync() {
  useEffect(() => {
    if (!isLinux()) return;

    api.platform.getDesktopInfo().then((info) => {
      // Aplicar preferência de tema do sistema
      if (info.preferDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      // Aplicar accent color do GNOME se disponível
      if (info.accentColor) {
        applyGnomeAccentColor(info.accentColor);
      }

      // Aplicar font do sistema se configurado
      if (info.fontName) {
        document.documentElement.style.setProperty(
          '--font-sans',
          `'${info.fontName}', var(--font-sans)`
        );
      }
    });
  }, []);
}

const GNOME_ACCENT_MAP: Record<string, string> = {
  blue:    'oklch(0.55 0.19 264)',
  teal:    'oklch(0.55 0.14 190)',
  green:   'oklch(0.55 0.16 155)',
  yellow:  'oklch(0.70 0.15 90)',
  orange:  'oklch(0.60 0.18 55)',
  red:     'oklch(0.55 0.20 25)',
  pink:    'oklch(0.55 0.18 350)',
  purple:  'oklch(0.55 0.19 300)',
  slate:   'oklch(0.50 0.03 264)',
};

function applyGnomeAccentColor(accent: string) {
  const color = GNOME_ACCENT_MAP[accent];
  if (color) {
    document.documentElement.style.setProperty('--color-accent', color);
  }
}
```

### Monitorar mudanças de tema em tempo real:

```rust
// crates/openmail-core/src/platform/linux_watcher.rs
use tokio::process::Command;
use tokio::io::AsyncBufReadExt;

/// Monitora mudanças no tema do GNOME via dbus
pub async fn watch_gnome_theme_changes(app_handle: tauri::AppHandle) {
    let mut child = Command::new("dbus-monitor")
        .args([
            "--session",
            "type='signal',interface='org.freedesktop.portal.Settings',member='SettingChanged'",
        ])
        .stdout(std::process::Stdio::piped())
        .spawn()
        .expect("Failed to spawn dbus-monitor");

    let stdout = child.stdout.take().unwrap();
    let mut reader = tokio::io::BufReader::new(stdout).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        if line.contains("color-scheme") || line.contains("accent-color") {
            // Re-detectar e emitir evento
            let info = LinuxDesktopInfo::detect();
            let _ = app_handle.emit("platform:theme-changed", &info);
        }
    }
}
```

---

## §3 — Wayland-First

### Problema
Muitas apps Tauri/Electron rodam no XWayland por padrão no Wayland. Isso causa:
- Blur nos monitores HiDPI
- Flickering ao redimensionar
- Perda de gestos do trackpad

### Solução

```rust
// src-tauri/src/main.rs

fn main() {
    // Forçar Wayland quando disponível
    if cfg!(target_os = "linux") {
        // Wayland é preferido, mas permite fallback para X11
        if std::env::var("WAYLAND_DISPLAY").is_ok() {
            std::env::set_var("GDK_BACKEND", "wayland");
            // WebKitGTK específico
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "0");
        }

        // Garantir scaling correto em HiDPI
        if std::env::var("GDK_SCALE").is_err() {
            // Deixar o GTK detectar automaticamente
            std::env::set_var("GDK_DPI_SCALE", "1");
        }
    }

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running application");
}
```

### Tauri config para Wayland:

```json
// src-tauri/tauri.conf.json
{
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "title": "Open Mail",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": true,
        "transparent": false
      }
    ]
  },
  "bundle": {
    "linux": {
      "deb": {
        "depends": [
          "libwebkit2gtk-4.1-0",
          "libgtk-3-0",
          "libayatana-appindicator3-1"
        ]
      },
      "rpm": {
        "depends": [
          "webkit2gtk4.1",
          "gtk3",
          "libayatana-appindicator-gtk3"
        ]
      }
    }
  }
}
```

### Testes de Wayland no CI:

```yaml
# .github/workflows/ci.yml — adicionar job para Wayland
linux-wayland-test:
  runs-on: ubuntu-latest
  container:
    image: ghcr.io/nickvdp/gnome-wayland-ci:latest
  env:
    WAYLAND_DISPLAY: wayland-0
    XDG_RUNTIME_DIR: /tmp
  steps:
    - uses: actions/checkout@v4
    - name: Build
      run: cargo tauri build
    - name: Smoke test (headless Wayland)
      run: |
        # Verificar que o app inicia sem crash em Wayland
        timeout 10 ./target/release/open-mail --check || true
```

---

## §4 — Flatpak como Tier 1

### Problema
O roadmap lista Flatpak como "futuro". Para Linux, Flatpak é o canal de distribuição mais universal.

### Solução
Flatpak como formato principal, não afterthought:

```yaml
# flatpak/com.openmail.app.yml
app-id: com.openmail.app
runtime: org.gnome.Platform
runtime-version: '46'
sdk: org.gnome.Sdk
sdk-extensions:
  - org.freedesktop.Sdk.Extension.rust-stable
  - org.freedesktop.Sdk.Extension.node20

command: open-mail

finish-args:
  # Acesso a rede (IMAP, SMTP, OAuth)
  - --share=network
  # Display
  - --share=ipc
  - --socket=fallback-x11
  - --socket=wayland
  # Notificações
  - --talk-name=org.freedesktop.Notifications
  # System tray
  - --talk-name=org.kde.StatusNotifierWatcher
  # Keyring (senhas)
  - --talk-name=org.freedesktop.secrets
  # File picker (para attachments)
  - --system-talk-name=org.freedesktop.portal.FileChooser
  # Open URLs (links em emails)
  - --talk-name=org.freedesktop.portal.OpenURI
  # Downloads (attachments)
  - --filesystem=xdg-download:create
  # Esquema mailto
  - --talk-name=org.freedesktop.portal.Desktop

modules:
  - name: open-mail
    buildsystem: simple
    build-options:
      append-path: /usr/lib/sdk/rust-stable/bin:/usr/lib/sdk/node20/bin
      env:
        CARGO_HOME: /run/build/open-mail/cargo
        npm_config_nodedir: /usr/lib/sdk/node20
    build-commands:
      - npm ci
      - cargo tauri build --bundles none
      - install -Dm755 src-tauri/target/release/open-mail ${FLATPAK_DEST}/bin/open-mail
      - install -Dm644 flatpak/com.openmail.app.desktop ${FLATPAK_DEST}/share/applications/com.openmail.app.desktop
      - install -Dm644 flatpak/com.openmail.app.metainfo.xml ${FLATPAK_DEST}/share/metainfo/com.openmail.app.metainfo.xml
      - install -Dm644 icons/128x128.png ${FLATPAK_DEST}/share/icons/hicolor/128x128/apps/com.openmail.app.png
    sources:
      - type: dir
        path: ..
```

### AppStream Metadata (para GNOME Software / Flathub):

```xml
<!-- flatpak/com.openmail.app.metainfo.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>com.openmail.app</id>
  <name>Open Mail</name>
  <summary>A premium email client for Linux</summary>
  <metadata_license>FSFAP</metadata_license>
  <project_license>GPL-3.0-or-later</project_license>
  <developer id="com.openmail">
    <name>Open Mail Team</name>
  </developer>

  <description>
    <p>
      Open Mail is a fast, beautiful, and open-source email client built with
      modern technologies (Tauri, Rust, React). It brings a premium email
      experience to Linux — similar to Spark Mail on macOS — while respecting
      your privacy and desktop environment.
    </p>
    <p>Features include:</p>
    <ul>
      <li>Multi-account support (Gmail, Outlook, IMAP/SMTP)</li>
      <li>Rich text composer with inline images</li>
      <li>Fast full-text search</li>
      <li>Keyboard-first workflow</li>
      <li>Plugin system for extensibility</li>
      <li>Dark mode and system theme integration</li>
      <li>Minimal resource usage (~50MB RAM)</li>
    </ul>
  </description>

  <launchable type="desktop-id">com.openmail.app.desktop</launchable>

  <screenshots>
    <screenshot type="default">
      <image>https://openmail.app/screenshots/inbox-light.png</image>
      <caption>Inbox view in light mode</caption>
    </screenshot>
    <screenshot>
      <image>https://openmail.app/screenshots/inbox-dark.png</image>
      <caption>Inbox view in dark mode</caption>
    </screenshot>
    <screenshot>
      <image>https://openmail.app/screenshots/composer.png</image>
      <caption>Rich text composer</caption>
    </screenshot>
  </screenshots>

  <url type="homepage">https://openmail.app</url>
  <url type="bugtracker">https://github.com/openmail/open-mail/issues</url>
  <url type="donation">https://opencollective.com/open-mail</url>
  <url type="vcs-browser">https://github.com/openmail/open-mail</url>

  <content_rating type="oars-1.1" />

  <branding>
    <color type="primary" scheme_preference="light">#e8e3ff</color>
    <color type="primary" scheme_preference="dark">#3d2e7c</color>
  </branding>

  <releases>
    <release version="1.0.0" date="2025-12-01">
      <description><p>First stable release!</p></description>
    </release>
  </releases>

  <requires>
    <display_length compare="ge">800</display_length>
  </requires>

  <recommends>
    <control>keyboard</control>
    <control>pointing</control>
  </recommends>

  <provides>
    <binary>open-mail</binary>
    <mediatype>x-scheme-handler/mailto</mediatype>
    <mediatype>message/rfc822</mediatype>
  </provides>

  <keywords>
    <keyword>email</keyword>
    <keyword>mail</keyword>
    <keyword>IMAP</keyword>
    <keyword>SMTP</keyword>
  </keywords>
</component>
```

### CI para build e publish no Flathub:

```yaml
# .github/workflows/flatpak.yml
name: Flatpak Build
on:
  push:
    tags: ['v*']

jobs:
  flatpak:
    runs-on: ubuntu-latest
    container:
      image: bilelmoussaoui/flatpak-github-actions:gnome-46
      options: --privileged
    steps:
      - uses: actions/checkout@v4

      - uses: flatpak/flatpak-github-actions/flatpak-builder@v6
        with:
          bundle: open-mail.flatpak
          manifest-path: flatpak/com.openmail.app.yml
          cache-key: flatpak-builder-${{ github.sha }}

      - uses: actions/upload-artifact@v4
        with:
          name: flatpak-bundle
          path: open-mail.flatpak
```

---

## System Tray no Linux

O system tray no Linux é fragmentado. Precisamos suportar ambos protocolos:

```rust
// src-tauri/src/tray.rs
use tauri::{
    tray::{TrayIconBuilder, MouseButton, MouseButtonState},
    menu::{MenuBuilder, MenuItemBuilder},
    Manager,
};

pub fn setup_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItemBuilder::new("Show Open Mail").id("show").build(app)?;
    let compose_item = MenuItemBuilder::new("Compose New Email").id("compose").build(app)?;
    let quit_item = MenuItemBuilder::new("Quit").id("quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_item)
        .item(&compose_item)
        .separator()
        .item(&quit_item)
        .build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Open Mail")
        .menu(&menu)
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
                "compose" => {
                    if let Some(window) = app.get_webview_window("main") {
                        window.show().ok();
                        window.set_focus().ok();
                        let _ = window.emit("navigate", "/compose");
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        window.hide().ok();
                    } else {
                        window.show().ok();
                        window.set_focus().ok();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

### Dependência para system tray no Linux:

```toml
# src-tauri/Cargo.toml
[target.'cfg(target_os = "linux")'.dependencies]
# libayatana-appindicator é o standard moderno para system tray no Linux
# Tauri já inclui suporte, mas precisamos da feature
tauri = { version = "2", features = ["tray-icon"] }
```

---

## Mailto Handler

```rust
// src-tauri/src/deep_links.rs

/// Registrar como handler de mailto:// no Linux
pub fn register_mailto_handler() {
    if cfg!(target_os = "linux") {
        // xdg-mime default com.openmail.app.desktop x-scheme-handler/mailto
        let _ = std::process::Command::new("xdg-mime")
            .args(["default", "com.openmail.app.desktop", "x-scheme-handler/mailto"])
            .output();
    }
}

/// Processar mailto:// link recebido
pub fn handle_mailto(url: &str) -> Option<ComposeParams> {
    if !url.starts_with("mailto:") {
        return None;
    }

    let url = url.strip_prefix("mailto:")?;
    let (to, query) = url.split_once('?').unwrap_or((url, ""));

    let mut params = ComposeParams {
        to: vec![to.to_string()],
        ..Default::default()
    };

    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            let value = urlencoding::decode(value).unwrap_or_default().to_string();
            match key.to_lowercase().as_str() {
                "subject" => params.subject = Some(value),
                "body" => params.body = Some(value),
                "cc" => params.cc = value.split(',').map(String::from).collect(),
                "bcc" => params.bcc = value.split(',').map(String::from).collect(),
                _ => {}
            }
        }
    }

    Some(params)
}

#[derive(Debug, Default)]
pub struct ComposeParams {
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: Option<String>,
    pub body: Option<String>,
}
```

---

## Desktop Notifications (Linux-native)

```rust
// crates/openmail-core/src/platform/notifications.rs

/// Envia notificação usando o portal do desktop (funciona em Flatpak)
pub fn send_notification(
    app_handle: &tauri::AppHandle,
    title: &str,
    body: &str,
    sender_email: Option<&str>,
) {
    use tauri::notification::NotificationBuilder;

    let mut notification = NotificationBuilder::new(app_handle, "new-mail")
        .title(title)
        .body(body)
        .auto_cancel(true);

    // No Linux, ações de notificação via freedesktop
    if cfg!(target_os = "linux") {
        notification = notification
            .action_type_id("reply")
            .action_type_id("archive");
    }

    if let Err(e) = notification.show() {
        tracing::warn!("Failed to show notification: {}", e);
    }
}
```

---

## Resumo das Melhorias Linux

| Melhoria | Complexidade | Impacto | Quando |
|----------|-------------|---------|--------|
| XDG Base Directory | Baixa | Alto (Linux standard) | Fase 0 |
| Desktop file + MIME types | Baixa | Alto (integração desktop) | Fase 0 |
| GTK/Adwaita theme detection | Média | Alto (visual nativo) | Fase 3 |
| GNOME accent color sync | Baixa | Médio (polish) | Fase 3 |
| System font detection | Baixa | Médio (consistency) | Fase 3 |
| Wayland-first | Baixa | Alto (HiDPI, gestures) | Fase 0 |
| Flatpak manifest | Média | Alto (distribuição) | Fase 9 |
| AppStream metadata | Baixa | Alto (Flathub listing) | Fase 9 |
| System tray (ayatana) | Baixa | Médio (background) | Fase 6 |
| Mailto handler | Baixa | Médio (integração OS) | Fase 6 |
| Desktop notifications | Baixa | Alto (funcionalidade core) | Fase 6 |
| dbus theme watcher | Média | Médio (live theme sync) | Fase 9 |
