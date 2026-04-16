# Fase 0 — Fundacao & Setup do Projeto

**Duracao estimada:** 2 semanas
**Objetivo:** Criar a estrutura base do projeto Tauri v2, configurar toolchain, CI/CD e validar que o skeleton compila e roda em todas as plataformas.

---

## Contexto

Esta fase nao entrega nenhuma feature visivel ao usuario final. Ela estabelece o alicerce tecnico sobre o qual todas as fases seguintes serao construidas. Um setup mal feito aqui propaga problemas por meses.

---

## Entregaveis

### 0.1 — Inicializar Projeto Tauri v2

**O que fazer:**
- `npm create tauri-app@latest open-mail` com template React + TypeScript + Vite
- Configurar `tauri.conf.json`:
  - `identifier`: `com.openmail.app`
  - `productName`: `Open Mail`
  - `windows`: configurar janela principal (titulo, dimensoes, decorations)
  - `security.csp`: Content Security Policy restritiva
- Validar build em dev: `cargo tauri dev`
- Validar build de producao: `cargo tauri build`

**Arquivos criados:**
```
open-mail/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   └── src/
│       ├── main.rs
│       └── lib.rs
├── src/
│   ├── main.tsx
│   └── App.tsx
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

**Criterio de aceite:**
- [ ] `cargo tauri dev` abre janela com "Hello Open Mail"
- [ ] `cargo tauri build` gera binario funcional
- [ ] Sem warnings no build Rust
- [ ] Sem erros no build TypeScript

---

### 0.2 — Configurar Frontend Base

**O que fazer:**
- Instalar dependencias frontend:
  ```bash
  npm install react@19 react-dom@19 zustand @tanstack/react-query
  npm install -D tailwindcss @tailwindcss/vite typescript @types/react @types/react-dom
  npm install lucide-react
  ```
- Configurar TailwindCSS v4 no `vite.config.ts`
- Criar `src/styles/globals.css` com design tokens (cores, espacamentos, tipografia)
- Configurar path aliases no `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "paths": {
        "@/*": ["./src/*"],
        "@components/*": ["./src/components/*"],
        "@stores/*": ["./src/stores/*"],
        "@hooks/*": ["./src/hooks/*"],
        "@lib/*": ["./src/lib/*"]
      }
    }
  }
  ```
- Criar componente `<App />` basico com layout placeholder

**Criterio de aceite:**
- [ ] TailwindCSS funciona no dev server
- [ ] Path aliases resolvem corretamente
- [ ] Hot reload funciona (alteracao em .tsx reflete no app)

---

### 0.3 — Configurar Backend Rust Base

**O que fazer:**
- Estruturar `Cargo.toml` com dependencias iniciais:
  ```toml
  [dependencies]
  tauri = { version = "2", features = ["tray-icon", "protocol-asset"] }
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  tokio = { version = "1", features = ["full"] }
  rusqlite = { version = "0.31", features = ["bundled"] }
  log = "0.4"
  env_logger = "0.11"
  thiserror = "1"
  uuid = { version = "1", features = ["v4", "serde"] }
  chrono = { version = "0.4", features = ["serde"] }
  ```
- Criar estrutura de modulos Rust:
  ```
  src-tauri/src/
  ├── main.rs           # Entry point
  ├── lib.rs            # Tauri setup + plugin registration
  ├── commands/         # IPC handlers (mod.rs vazio por ora)
  ├── domain/           # Domain layer (mod.rs vazio por ora)
  │   ├── models/
  │   ├── events.rs
  │   └── errors.rs
  ├── infrastructure/   # Infra layer (mod.rs vazio por ora)
  │   ├── database/
  │   └── sync/
  └── plugins/          # Plugin host (mod.rs vazio por ora)
  ```
- Implementar um Tauri command de health check:
  ```rust
  #[tauri::command]
  async fn health_check() -> Result<String, String> {
      Ok("Open Mail backend running".to_string())
  }
  ```
- Chamar do frontend para validar IPC

**Criterio de aceite:**
- [ ] Modulos Rust compilam sem erro
- [ ] `invoke("health_check")` retorna resposta no frontend
- [ ] Logging funciona (`RUST_LOG=debug cargo tauri dev`)

---

### 0.4 — Configurar Linting, Formatting e Type Checking

**O que fazer:**

**Frontend:**
- ESLint 9 (flat config) com:
  - `@typescript-eslint`
  - `eslint-plugin-react`
  - `eslint-plugin-react-hooks`
- Prettier com config padrao
- Scripts no `package.json`:
  ```json
  {
    "scripts": {
      "dev": "tauri dev",
      "build": "tauri build",
      "lint": "eslint src/",
      "lint:fix": "eslint src/ --fix",
      "typecheck": "tsc --noEmit",
      "format": "prettier --write src/",
      "test": "vitest",
      "test:e2e": "playwright test"
    }
  }
  ```

**Backend:**
- `rustfmt.toml` com config padrao
- `clippy.toml` com lints restritivos:
  ```toml
  # clippy.toml
  cognitive-complexity-threshold = 15
  ```
- `cargo clippy -- -D warnings` deve passar

**Criterio de aceite:**
- [ ] `npm run lint` passa sem erros
- [ ] `npm run typecheck` passa sem erros
- [ ] `cargo clippy -- -D warnings` passa sem erros
- [ ] `cargo fmt --check` passa sem erros

---

### 0.5 — Configurar Testes

**O que fazer:**

**Frontend (Vitest):**
- Instalar: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- Configurar `vitest.config.ts`:
  ```typescript
  import { defineConfig } from 'vitest/config';
  
  export default defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  });
  ```
- Criar teste canario: `src/test/smoke.test.ts`
- Criar `src/test/setup.ts` com matchers

**Backend (Rust):**
- Criar modulo de testes em `src-tauri/src/lib.rs`:
  ```rust
  #[cfg(test)]
  mod tests {
      #[test]
      fn smoke_test() {
          assert!(true);
      }
  }
  ```

**E2E (Playwright — futuro):**
- Instalar: `npm install -D @playwright/test`
- Criar `playwright.config.ts` basico (sera expandido na Fase 3)

**Criterio de aceite:**
- [ ] `npm run test` executa e passa teste canario
- [ ] `cargo test` executa e passa teste canario
- [ ] Coverage report funciona: `vitest --coverage`

---

### 0.6 — Configurar CI/CD (GitHub Actions)

**O que fazer:**
- Criar `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    frontend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - run: npm ci
        - run: npm run lint
        - run: npm run typecheck
        - run: npm run test

    backend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: dtolnay/rust-toolchain@stable
        - run: cargo fmt --check
        - run: cargo clippy -- -D warnings
        - run: cargo test

    build:
      strategy:
        matrix:
          os: [ubuntu-latest, macos-latest, windows-latest]
      runs-on: ${{ matrix.os }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
        - uses: dtolnay/rust-toolchain@stable
        - run: npm ci
        - run: cargo tauri build
  ```

**Criterio de aceite:**
- [ ] CI roda em push e PR
- [ ] Build passa em Linux, macOS e Windows
- [ ] Lint + typecheck + testes passam no CI

---

### 0.7 — Documentacao Base

**O que fazer:**
- Criar `README.md` do projeto:
  - Descricao do projeto
  - Pre-requisitos (Rust, Node.js, system dependencies)
  - Como rodar em dev
  - Como buildar
  - Estrutura de diretorios
- Criar `CONTRIBUTING.md` basico
- Criar `ADR/` (Architecture Decision Records):
  - `ADR-001-tauri-over-electron.md`
  - `ADR-002-rust-sync-engine.md`
  - `ADR-003-zustand-over-reflux.md`

**Criterio de aceite:**
- [ ] Novo contribuidor consegue rodar o projeto seguindo o README
- [ ] ADRs documentam as 3 decisoes fundamentais

---

## Dependencias Externas

| Dependencia          | Versao Minima | Motivo                         |
|----------------------|---------------|--------------------------------|
| Rust                 | 1.77+         | Tauri v2 requirement           |
| Node.js              | 20 LTS        | Vite + tooling                 |
| System libs (Linux)  | libwebkit2gtk | Tauri webview                  |
| Xcode CLI (macOS)    | 15+           | Compilacao nativa              |

---

## Riscos desta Fase

| Risco                                        | Mitigacao                                  |
|----------------------------------------------|--------------------------------------------|
| Dependencias de sistema no Linux (webkit2gtk) | Documentar no README e testar em CI        |
| Incompatibilidade Vite + Tauri v2            | Usar template oficial como base            |
| Configuracao de path aliases no Vite         | Usar `vite-tsconfig-paths`                 |

---

## Checklist Final da Fase 0

- [ ] Projeto Tauri v2 inicializado e compilando
- [ ] Frontend React 19 + TailwindCSS v4 funcional
- [ ] Backend Rust estruturado em camadas (domain/infra/commands)
- [ ] IPC validado (frontend chama backend e recebe resposta)
- [ ] Linting e formatting configurados (frontend + backend)
- [ ] Testes configurados (Vitest + cargo test)
- [ ] CI/CD rodando em 3 plataformas
- [ ] README permite onboarding de novo dev em <30 min
- [ ] Zero warnings em build

---

**Proxima fase:** [Fase 1 — Domain Models & Database](./fase_1.md)
