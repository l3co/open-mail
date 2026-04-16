# Open Mail — Análise de Melhorias & Guia de Implementação

> Este documento é o índice mestre de todas as melhorias identificadas sobre o roadmap original.
> Cada seção aponta para um guia detalhado com exemplos de código prontos para implementação.

---

## Diagnóstico do Roadmap Atual

O roadmap original (fases 0-9) é **sólido em escopo e sequenciamento**, mas opera como um plano de *reescrita funcional* — ou seja, replica o Mailspring com tecnologia nova. Para transformar o Open Mail em um produto **premium que compete com Spark Mail**, precisamos elevar em 5 eixos:

| Eixo | Gap Identificado | Impacto |
|------|------------------|---------|
| **Rust Pro** | Models anêmicos, IDs como `String`, sem CQRS, sync sem actor model | Fragilidade do domínio, bugs de concorrência |
| **React Pro** | Stores monolíticos, sem Suspense, sem state machines, sem otimistic UI robusto | UX lenta, re-renders, estados impossíveis |
| **Design Luxo** | Tokens genéricos, sem motion design, sem depth system, sem microinterações | App genérica, não compete com Spark |
| **Linux First** | Menção superficial, sem XDG, sem Wayland, sem theming nativo | Comunidade Linux não adota |
| **DX & Quality** | Sem property testing, sem benchmarks, sem contract tests Rust↔TS | Bugs em produção, regressões |

---

## Mapa de Melhorias por Fase

### Fase 0 — Fundação
| # | Melhoria | Guia |
|---|----------|------|
| M0.1 | Monorepo com Turborepo + Cargo workspace | `guia_rust_pro.md` §1 |
| M0.2 | `ts-rs` para gerar tipos TS a partir de Rust automaticamente | `guia_rust_pro.md` §2 |
| M0.3 | Biome ao invés de ESLint+Prettier (10x mais rápido) | `guia_react_pro.md` §1 |
| M0.4 | Storybook para design system isolado | `guia_design_luxo.md` §1 |
| M0.5 | XDG Base Directory desde o dia 1 | `guia_linux_first.md` §1 |

### Fase 1 — Domain Models & Database
| # | Melhoria | Guia |
|---|----------|------|
| M1.1 | **Newtype IDs** — `AccountId(Uuid)` ao invés de `String` | `guia_rust_pro.md` §3 |
| M1.2 | **Value Objects** — `EmailAddress`, `Snippet`, `Subject` | `guia_rust_pro.md` §4 |
| M1.3 | **Rich Domain Models** com behavior (não anêmicos) | `guia_rust_pro.md` §5 |
| M1.4 | **Builder Pattern** para criação de modelos complexos | `guia_rust_pro.md` §6 |
| M1.5 | **CQRS-lite** — separar ReadModels de WriteModels | `guia_rust_pro.md` §7 |
| M1.6 | **`sea-query`** para SQL type-safe (sem strings raw) | `guia_rust_pro.md` §8 |
| M1.7 | **`refinery`** para migrations versionadas | `guia_rust_pro.md` §9 |
| M1.8 | **Property-based testing** com `proptest` | `guia_rust_pro.md` §10 |

### Fase 2 — Sync Engine
| # | Melhoria | Guia |
|---|----------|------|
| M2.1 | **Actor Model** com `tokio::mpsc` para sync workers | `guia_rust_pro.md` §11 |
| M2.2 | **Circuit Breaker** pattern para IMAP connections | `guia_rust_pro.md` §12 |
| M2.3 | **Tracing** (não log) com spans estruturados desde o dia 1 | `guia_rust_pro.md` §13 |
| M2.4 | **Graceful Shutdown** com signal handling e drain | `guia_rust_pro.md` §14 |
| M2.5 | **Delta Sync** — CONDSTORE/QRESYNC para sync eficiente | `guia_rust_pro.md` §15 |
| M2.6 | **Outbox Pattern** para task queue persistente | `guia_rust_pro.md` §16 |

### Fase 3 — UI Shell & Layout
| # | Melhoria | Guia |
|---|----------|------|
| M3.1 | **Framer Motion** para animações premium (60fps) | `guia_design_luxo.md` §2 |
| M3.2 | **Glass Morphism** — sidebar e modais com blur/frosted | `guia_design_luxo.md` §3 |
| M3.3 | **Depth System** — elevação com sombras e layers | `guia_design_luxo.md` §4 |
| M3.4 | **Typography Scale** — modullar scale premium | `guia_design_luxo.md` §5 |
| M3.5 | **Command Palette** (Cmd+K) estilo Linear/Raycast | `guia_react_pro.md` §2 |
| M3.6 | **Radix UI Primitives** para acessibilidade nativa | `guia_react_pro.md` §3 |
| M3.7 | **Custom Scrollbars** com estilo luxuoso | `guia_design_luxo.md` §6 |
| M3.8 | **View Transitions API** para navegação fluida | `guia_react_pro.md` §4 |

### Fase 4 — Thread List & Message View
| # | Melhoria | Guia |
|---|----------|------|
| M4.1 | **Render-as-you-fetch** com React Suspense | `guia_react_pro.md` §5 |
| M4.2 | **Skeleton Loading** com shimmer animado (Spark-like) | `guia_design_luxo.md` §7 |
| M4.3 | **Swipe Gestures** para mobile-like interactions | `guia_react_pro.md` §6 |
| M4.4 | **CSS Containment** para virtualized lists | `guia_react_pro.md` §7 |
| M4.5 | **Shadow DOM** para email rendering isolado | `guia_react_pro.md` §8 |
| M4.6 | **Avatar Generation** com gradientes únicos por contato | `guia_design_luxo.md` §8 |

### Fase 5 — Composer
| # | Melhoria | Guia |
|---|----------|------|
| M5.1 | **Slash Commands** no TipTap (/, @, #) | `guia_react_pro.md` §9 |
| M5.2 | **AI Autocomplete** hook point (futuro) | `guia_react_pro.md` §10 |
| M5.3 | **Composer como Modal** com animação Spark-like | `guia_design_luxo.md` §9 |
| M5.4 | **Smart Recipient** — sugestões contextuais | `guia_react_pro.md` §11 |

### Fase 6 — Account Management
| # | Melhoria | Guia |
|---|----------|------|
| M6.1 | **State Machine** com XState para onboarding flow | `guia_react_pro.md` §12 |
| M6.2 | **Onboarding Premium** — animações, progress, branding | `guia_design_luxo.md` §10 |

### Fase 7-9 — Features, Plugins, Polish
| # | Melhoria | Guia |
|---|----------|------|
| M7.1 | **Notification Center** — hub centralizado, não toasts dispersos | `guia_design_luxo.md` §11 |
| M8.1 | **Hot Module Reload** para plugins em desenvolvimento | `guia_react_pro.md` §13 |
| M9.1 | **Linux-native look** — respeitar GTK/Adwaita themes | `guia_linux_first.md` §2 |
| M9.2 | **Wayland-first** — sem fallback X11 como default | `guia_linux_first.md` §3 |
| M9.3 | **Flatpak como tier 1** — não afterthought | `guia_linux_first.md` §4 |

---

## Guias Detalhados

| Guia | Conteúdo | Tamanho Estimado |
|------|----------|------------------|
| [`guia_rust_pro.md`](./guia_rust_pro.md) | 16 seções com padrões Rust avançados, exemplos compiláveis | ~40KB |
| [`guia_react_pro.md`](./guia_react_pro.md) | 13 seções com padrões React 19, hooks, state machines | ~35KB |
| [`guia_design_luxo.md`](./guia_design_luxo.md) | 11 seções com design system luxuoso, Spark-inspired | ~30KB |
| [`guia_linux_first.md`](./guia_linux_first.md) | 4 seções com Linux-first development | ~15KB |

---

## Priorização das Melhorias

### Tier 1 — Fundacional (implementar antes de qualquer fase)
> Sem isso, todo o código subsequente nasce com débito.

- **M1.1** Newtype IDs
- **M1.2** Value Objects
- **M1.3** Rich Domain Models
- **M0.2** ts-rs (geração automática de tipos)
- **M2.3** Tracing desde o dia 1
- **M0.5** XDG compliance

### Tier 2 — Diferencial Competitivo (implementar nas fases 3-5)
> Isso é o que separa "mais um email client" de um produto premium.

- **M3.1** Framer Motion animations
- **M3.2** Glass Morphism
- **M3.5** Command Palette
- **M4.6** Avatar Generation
- **M5.3** Composer Modal animado
- **M6.2** Onboarding Premium

### Tier 3 — Excelência Técnica (implementar nas fases 6-9)
> Isso sustenta o produto a longo prazo.

- **M2.1** Actor Model para sync
- **M2.6** Outbox Pattern
- **M1.5** CQRS-lite
- **M9.1-M9.3** Linux-native

---

## Impacto Esperado

| Métrica | Roadmap Original | Com Melhorias |
|---------|------------------|---------------|
| RAM idle (1 conta) | ~80MB | ~50MB (CQRS + read models otimizados) |
| Cold start | ~1.5s | ~800ms (lazy loading + code splitting agressivo) |
| Percepção de velocidade | Funcional | Premium (skeleton + motion + optimistic UI) |
| Adoção Linux | Funcional | Nativa (XDG, Wayland, Flatpak tier 1) |
| Developer Experience | Boa | Excelente (ts-rs, property tests, tracing) |
| Manutenibilidade | Boa | Excelente (rich domain, newtype IDs, CQRS) |
| UX Quality | Gmail-like | Spark-like (depth, glass, motion, typography) |

---

## Próximos Passos

Leia os guias na seguinte ordem:

1. **[`guia_rust_pro.md`](./guia_rust_pro.md)** — Fundação do backend
2. **[`guia_design_luxo.md`](./guia_design_luxo.md)** — Identidade visual premium
3. **[`guia_react_pro.md`](./guia_react_pro.md)** — Frontend de excelência
4. **[`guia_linux_first.md`](./guia_linux_first.md)** — Linux como cidadão de primeira classe
