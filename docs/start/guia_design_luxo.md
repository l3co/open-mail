# Guia Design Luxo — Estética Premium Spark-like para o Open Mail

> O Spark Mail no macOS é referência em design de email client: limpo, espaçoso, com profundidade e movimento.
> Este guia traduz essa qualidade visual em tokens, componentes e padrões implementáveis.
> O objetivo é que o Open Mail seja o **melhor email client visual do Linux** — e competitivo no macOS/Windows.

---

## §1 — Storybook para Design System Isolado

### Problema
Componentes desenvolvidos dentro do app ficam acoplados ao estado. Difícil iterar em design sem rodar toda a aplicação.

### Solução
Storybook como playground isolado para design system:

```bash
npx storybook@latest init --type react
npm install -D @storybook/addon-a11y @storybook/addon-themes
```

```ts
// .storybook/preview.ts
import type { Preview } from '@storybook/react';
import '../src/styles/globals.css';

const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
    layout: 'centered',
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'sun',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme;
      document.documentElement.setAttribute('data-theme', theme);
      return <Story />;
    },
  ],
};

export default preview;
```

```tsx
// src/components/ui/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary', children: 'Send Email' } };
export const Secondary: Story = { args: { variant: 'secondary', children: 'Cancel' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'More options' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Delete' } };
```

---

## §2 — Motion Design com Framer Motion

### Problema
O roadmap original não menciona animações. Sem motion, a app parece estática e amadora.

### Solução
Framer Motion para animações declarativas em toda a aplicação:

```bash
npm install framer-motion
```

### Princípios de Motion do Open Mail

| Princípio | Detalhe |
|-----------|---------|
| **Rápido** | Máximo 200ms para micro-interações, 300ms para transições de page |
| **Suave** | Ease-out para entradas, ease-in para saídas |
| **Intencional** | Cada animação tem propósito (feedback, orientação, deleite) |
| **Consistente** | Mesmas curvas e durações em toda a app |
| **Respeitoso** | Honrar `prefers-reduced-motion` |

### Tokens de Motion

```tsx
// src/lib/motion.ts
import { type Variants } from 'framer-motion';

export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  page: 0.35,
} as const;

export const EASE = {
  out: [0.16, 1, 0.3, 1],         // Entradas suaves
  in: [0.4, 0, 1, 1],             // Saídas
  inOut: [0.4, 0, 0.2, 1],        // Transformações
  spring: { type: 'spring', stiffness: 400, damping: 30 },
} as const;

// Variantes reutilizáveis
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.instant } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE.out },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DURATION.fast, ease: EASE.in },
  },
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATION.normal, ease: EASE.out },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: DURATION.fast, ease: EASE.in },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATION.normal, ease: EASE.out },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: DURATION.fast, ease: EASE.in },
  },
};

export const staggerChildren: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.03 },
  },
};

// Hook para respeitar reduced motion
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}
```

### Exemplos de Uso

```tsx
// Thread list items aparecem com stagger
import { motion, AnimatePresence } from 'framer-motion';
import { slideUp, staggerChildren } from '@lib/motion';

function ThreadListAnimated({ threads }: { threads: ThreadSummary[] }) {
  return (
    <motion.div variants={staggerChildren} initial="hidden" animate="visible">
      <AnimatePresence>
        {threads.map((thread) => (
          <motion.div
            key={thread.id}
            variants={slideUp}
            exit="exit"
            layout
            layoutId={thread.id}
          >
            <ThreadListItem thread={thread} />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
```

```tsx
// Toast notification com slide + spring
function Toast({ message, onDismiss }: ToastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="toast"
    >
      {message}
      <button onClick={onDismiss}>×</button>
    </motion.div>
  );
}
```

---

## §3 — Glass Morphism (Sidebar & Modals)

### Problema
O roadmap lista sidebar e modals com backgrounds opacos. Isso é flat e genérico.

### Solução
Glass morphism — blur, translucência, bordas sutis — como no Spark Mail e macOS nativo:

```css
/* src/styles/glass.css */

/* Sidebar com efeito glass */
.sidebar-glass {
  @apply relative;
  background: oklch(0.98 0 0 / 0.7);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-right: 1px solid oklch(0.9 0 0 / 0.5);
}

/* Dark mode */
[data-theme='dark'] .sidebar-glass {
  background: oklch(0.15 0 0 / 0.75);
  border-right: 1px solid oklch(0.3 0 0 / 0.3);
}

/* Modal com glass */
.modal-glass {
  background: oklch(0.99 0 0 / 0.85);
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid oklch(0.9 0 0 / 0.6);
  border-radius: 20px;
  box-shadow:
    0 0 0 1px oklch(0 0 0 / 0.03),
    0 8px 40px oklch(0 0 0 / 0.12),
    0 2px 8px oklch(0 0 0 / 0.06);
}

[data-theme='dark'] .modal-glass {
  background: oklch(0.18 0 0 / 0.85);
  border: 1px solid oklch(0.35 0 0 / 0.4);
  box-shadow:
    0 0 0 1px oklch(1 0 0 / 0.03),
    0 8px 40px oklch(0 0 0 / 0.4),
    0 2px 8px oklch(0 0 0 / 0.2);
}

/* Overlay escurecido atrás do modal */
.modal-overlay {
  background: oklch(0 0 0 / 0.3);
  backdrop-filter: blur(4px);
}

[data-theme='dark'] .modal-overlay {
  background: oklch(0 0 0 / 0.5);
}

/* Toolbar com glass sutil */
.toolbar-glass {
  background: oklch(0.98 0 0 / 0.8);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid oklch(0.9 0 0 / 0.5);
}

[data-theme='dark'] .toolbar-glass {
  background: oklch(0.15 0 0 / 0.8);
  border-bottom: 1px solid oklch(0.3 0 0 / 0.3);
}
```

### Componente Modal Glass

```tsx
// src/components/ui/Modal.tsx
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { scaleIn } from '@lib/motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
};

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="modal-overlay fixed inset-0 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                className={`modal-glass fixed z-50 left-1/2 top-1/2 w-[90vw] ${sizes[size]} p-0 overflow-hidden`}
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                exit="exit"
                style={{ x: '-50%', y: '-50%' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                  <Dialog.Title className="text-base font-semibold text-text-primary">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors">
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Content */}
                <div className="px-6 py-5">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

---

## §4 — Depth System (Elevation & Shadows)

### Problema
Elementos no mesmo plano visual — tudo flat, sem hierarquia.

### Solução
Sistema de elevação com 5 níveis:

```css
/* src/styles/elevation.css */

:root {
  /* Elevation 0 — Fundo base */
  --shadow-0: none;

  /* Elevation 1 — Cards, thread list items on hover */
  --shadow-1:
    0 1px 2px oklch(0 0 0 / 0.04),
    0 1px 3px oklch(0 0 0 / 0.06);

  /* Elevation 2 — Dropdowns, tooltips, popovers */
  --shadow-2:
    0 2px 4px oklch(0 0 0 / 0.04),
    0 4px 12px oklch(0 0 0 / 0.08);

  /* Elevation 3 — Modals, command palette */
  --shadow-3:
    0 4px 8px oklch(0 0 0 / 0.04),
    0 8px 32px oklch(0 0 0 / 0.12),
    0 0 0 1px oklch(0 0 0 / 0.02);

  /* Elevation 4 — Floating composer, notifications */
  --shadow-4:
    0 8px 16px oklch(0 0 0 / 0.06),
    0 16px 48px oklch(0 0 0 / 0.16),
    0 0 0 1px oklch(0 0 0 / 0.03);

  /* Ring focus — para acessibilidade */
  --ring-focus: 0 0 0 2px oklch(0.62 0.19 264), 0 0 0 4px oklch(0.62 0.19 264 / 0.2);
}

[data-theme='dark'] {
  --shadow-1:
    0 1px 2px oklch(0 0 0 / 0.2),
    0 1px 3px oklch(0 0 0 / 0.3);
  --shadow-2:
    0 2px 4px oklch(0 0 0 / 0.2),
    0 4px 12px oklch(0 0 0 / 0.35);
  --shadow-3:
    0 4px 8px oklch(0 0 0 / 0.25),
    0 8px 32px oklch(0 0 0 / 0.4),
    0 0 0 1px oklch(1 0 0 / 0.05);
  --shadow-4:
    0 8px 16px oklch(0 0 0 / 0.3),
    0 16px 48px oklch(0 0 0 / 0.5),
    0 0 0 1px oklch(1 0 0 / 0.05);
}
```

```tsx
// Tailwind utilities
// tailwind.config.ts
export default {
  theme: {
    extend: {
      boxShadow: {
        'elevation-0': 'var(--shadow-0)',
        'elevation-1': 'var(--shadow-1)',
        'elevation-2': 'var(--shadow-2)',
        'elevation-3': 'var(--shadow-3)',
        'elevation-4': 'var(--shadow-4)',
        'ring-focus': 'var(--ring-focus)',
      },
    },
  },
};
```

---

## §5 — Typography Scale Premium

### Problema
O roadmap usa tokens genéricos. Tipografia premium requer escala modular e pesos precisos.

### Solução
Escala baseada em 1.2 (Minor Third) com a fonte Inter:

```css
/* src/styles/typography.css */
@import url('https://rsms.me/inter/inter.css');

:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* Type Scale — Minor Third (1.2) */
  --text-xs: 0.694rem;    /* 11.1px */
  --text-sm: 0.833rem;    /* 13.3px */
  --text-base: 1rem;      /* 16px */
  --text-md: 1.125rem;    /* 18px - usada para subject em thread view */
  --text-lg: 1.2rem;      /* 19.2px */
  --text-xl: 1.44rem;     /* 23px */
  --text-2xl: 1.728rem;   /* 27.6px */
  --text-3xl: 2.074rem;   /* 33.2px */

  /* Line Heights */
  --leading-tight: 1.2;
  --leading-snug: 1.35;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* Font Weights */
  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* Letter Spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.02em;
  --tracking-widest: 0.08em;
}

/* Optical sizing para Inter */
body {
  font-family: var(--font-sans);
  font-feature-settings: 'liga' 1, 'calt' 1, 'cv01' 1, 'cv02' 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Tamanho menor: tracking mais aberto */
.text-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
  line-height: var(--leading-tight);
  color: var(--color-text-tertiary);
}

/* Subject na thread list */
.text-thread-subject {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-snug);
}

/* Subject na message view */
.text-message-subject {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-tight);
}

/* Snippet na thread list */
.text-thread-snippet {
  font-size: var(--text-sm);
  font-weight: var(--font-regular);
  letter-spacing: var(--tracking-normal);
  line-height: var(--leading-normal);
  color: var(--color-text-secondary);
}

/* Sender name na thread list */
.text-sender {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  letter-spacing: var(--tracking-normal);
  line-height: var(--leading-snug);
}

/* Timestamp */
.text-timestamp {
  font-size: var(--text-xs);
  font-weight: var(--font-regular);
  letter-spacing: var(--tracking-normal);
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
}
```

---

## §6 — Custom Scrollbars Luxuosos

### Problema
Scrollbars nativas (especialmente no Linux/Windows) são grossas e visualmente destoantes.

### Solução
Scrollbars customizados que aparecem ao interagir:

```css
/* src/styles/scrollbar.css */

/* Thin scrollbar — aparece on hover */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s;
}

.scrollbar-thin:hover {
  scrollbar-color: oklch(0.7 0 0 / 0.35) transparent;
}

.scrollbar-thin:active {
  scrollbar-color: oklch(0.6 0 0 / 0.5) transparent;
}

/* WebKit (Chrome, Safari, Tauri WebView) */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s;
}

.scrollbar-thin:hover::-webkit-scrollbar-thumb {
  background: oklch(0.7 0 0 / 0.35);
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: oklch(0.6 0 0 / 0.5);
}

.scrollbar-thin::-webkit-scrollbar-thumb:active {
  background: oklch(0.5 0 0 / 0.6);
}

/* Dark mode */
[data-theme='dark'] .scrollbar-thin:hover::-webkit-scrollbar-thumb {
  background: oklch(0.5 0 0 / 0.4);
}

/* Scrollbar sempre invisível — para sidebar */
.scrollbar-hidden {
  scrollbar-width: none;
}
.scrollbar-hidden::-webkit-scrollbar {
  display: none;
}
```

---

## §7 — Skeleton Loading com Shimmer

### Problema
Loading states com spinners parecem lentos. Spark Mail usa shimmer placeholders.

### Solução

```css
/* src/styles/skeleton.css */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  @apply rounded-md;
  background: linear-gradient(
    90deg,
    oklch(0.94 0 0) 25%,
    oklch(0.90 0 0) 50%,
    oklch(0.94 0 0) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

[data-theme='dark'] .skeleton {
  background: linear-gradient(
    90deg,
    oklch(0.22 0 0) 25%,
    oklch(0.26 0 0) 50%,
    oklch(0.22 0 0) 75%
  );
  background-size: 200% 100%;
}
```

```tsx
// src/components/skeletons/ThreadListSkeleton.tsx

export function ThreadListSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="flex flex-col" role="status" aria-label="Loading emails...">
      {Array.from({ length: count }, (_, i) => (
        <ThreadItemSkeleton key={i} delay={i * 0.05} />
      ))}
    </div>
  );
}

function ThreadItemSkeleton({ delay }: { delay: number }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 border-b border-border-subtle"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Avatar */}
      <div className="skeleton h-9 w-9 rounded-full flex-shrink-0" />

      <div className="flex-1 min-w-0 space-y-2">
        {/* Sender + Date */}
        <div className="flex items-center justify-between">
          <div className="skeleton h-3.5 w-28" />
          <div className="skeleton h-3 w-12" />
        </div>

        {/* Subject */}
        <div className="skeleton h-3.5 w-3/4" />

        {/* Snippet */}
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}

// Skeleton para Message View
export function MessageViewSkeleton() {
  return (
    <div className="p-6 space-y-6" role="status" aria-label="Loading message...">
      {/* Subject */}
      <div className="skeleton h-7 w-2/3" />

      {/* Sender info */}
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="space-y-1.5">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-3 w-48" />
        </div>
      </div>

      {/* Body */}
      <div className="space-y-2 pt-4">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-3/4" />
      </div>
    </div>
  );
}
```

---

## §8 — Avatar Generation com Gradientes Únicos

### Problema
Avatares genéricos (iniciais cinzas) não dão personalidade visual.

### Solução
Avatares com gradientes determinísticos baseados no hash do email — como no Spark:

```tsx
// src/components/ui/Avatar.tsx
import { useMemo } from 'react';

interface AvatarProps {
  name?: string;
  email: string;
  avatarHash: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  imageUrl?: string;
}

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

// 12 paletas de gradiente premium — cores elegantes, não saturadas demais
const GRADIENT_PALETTES = [
  { from: '#6366f1', to: '#8b5cf6' },   // Indigo → Violet
  { from: '#3b82f6', to: '#06b6d4' },   // Blue → Cyan
  { from: '#10b981', to: '#059669' },   // Emerald → Green
  { from: '#f59e0b', to: '#ef4444' },   // Amber → Red
  { from: '#ec4899', to: '#8b5cf6' },   // Pink → Violet
  { from: '#14b8a6', to: '#3b82f6' },   // Teal → Blue
  { from: '#f97316', to: '#f59e0b' },   // Orange → Amber
  { from: '#8b5cf6', to: '#ec4899' },   // Violet → Pink
  { from: '#06b6d4', to: '#10b981' },   // Cyan → Emerald
  { from: '#ef4444', to: '#f97316' },   // Red → Orange
  { from: '#a855f7', to: '#6366f1' },   // Purple → Indigo
  { from: '#0ea5e9', to: '#6366f1' },   // Sky → Indigo
];

function hashToIndex(hash: string): number {
  let num = 0;
  for (let i = 0; i < Math.min(hash.length, 8); i++) {
    num = ((num << 5) - num + hash.charCodeAt(i)) | 0;
  }
  return Math.abs(num) % GRADIENT_PALETTES.length;
}

function getInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return '?';
}

export function Avatar({ name, email, avatarHash, size = 'md', imageUrl }: AvatarProps) {
  const gradient = useMemo(() => {
    const idx = hashToIndex(avatarHash);
    return GRADIENT_PALETTES[idx];
  }, [avatarHash]);

  const initials = useMemo(() => getInitials(name, email), [name, email]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || email}
        className={`${SIZES[size]} rounded-full object-cover ring-1 ring-black/5`}
      />
    );
  }

  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-semibold text-white ring-1 ring-black/10 select-none`}
      style={{
        background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
      }}
      title={name || email}
      aria-label={`Avatar for ${name || email}`}
    >
      {initials}
    </div>
  );
}
```

---

## §9 — Composer como Modal Animado (Spark-like)

### Problema
No Mailspring, o composer abre inline no bottom. No Spark, é um modal flutuante elegante.

### Solução
Composer como floating panel com animação:

```tsx
// src/components/composer/ComposerModal.tsx
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useState, useRef } from 'react';
import { Minimize2, Maximize2, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  draftId: string;
}

type ComposerMode = 'modal' | 'minimized' | 'fullscreen';

export function ComposerModal({ isOpen, onClose, draftId }: Props) {
  const [mode, setMode] = useState<ComposerMode>('modal');
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Constraints container */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40" />

      <AnimatePresence>
        {isOpen && mode === 'modal' && (
          <motion.div
            className="fixed z-50 pointer-events-auto"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: 'spring', stiffness: 400, damping: 30 },
            }}
            exit={{
              opacity: 0,
              y: 20,
              scale: 0.95,
              transition: { duration: 0.15 },
            }}
            drag
            dragControls={dragControls}
            dragConstraints={constraintsRef}
            dragElastic={0.05}
            style={{
              right: 24,
              bottom: 24,
              width: 580,
              maxHeight: 'calc(100vh - 48px)',
            }}
          >
            <div className="composer-container">
              {/* Draggable header */}
              <div
                className="composer-header"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <span className="text-sm font-medium text-text-primary">
                  New Message
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMode('minimized')}
                    className="p-1 rounded hover:bg-bg-hover"
                  >
                    <Minimize2 size={14} />
                  </button>
                  <button
                    onClick={() => setMode('fullscreen')}
                    className="p-1 rounded hover:bg-bg-hover"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Composer body */}
              <ComposerContent draftId={draftId} />
            </div>
          </motion.div>
        )}

        {isOpen && mode === 'minimized' && (
          <motion.div
            className="fixed z-50 right-6 bottom-6 pointer-events-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <button
              onClick={() => setMode('modal')}
              className="composer-minimized"
            >
              <span className="text-sm font-medium">New Message</span>
              <Maximize2 size={14} />
            </button>
          </motion.div>
        )}

        {isOpen && mode === 'fullscreen' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="modal-overlay absolute inset-0" />
            <motion.div
              className="relative w-[90vw] max-w-[800px] max-h-[85vh]"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div className="composer-container h-full">
                <div className="composer-header">
                  <span className="text-sm font-medium">New Message</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setMode('modal')} className="p-1 rounded hover:bg-bg-hover">
                      <Minimize2 size={14} />
                    </button>
                    <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <ComposerContent draftId={draftId} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

```css
.composer-container {
  @apply flex flex-col overflow-hidden;
  background: oklch(0.99 0 0 / 0.95);
  backdrop-filter: blur(40px) saturate(180%);
  border: 1px solid oklch(0.9 0 0 / 0.6);
  border-radius: 16px;
  box-shadow: var(--shadow-4);
}

[data-theme='dark'] .composer-container {
  background: oklch(0.16 0 0 / 0.95);
  border: 1px solid oklch(0.35 0 0 / 0.4);
}

.composer-header {
  @apply flex items-center justify-between px-4 py-2.5
         border-b border-border-subtle cursor-grab active:cursor-grabbing;
}

.composer-minimized {
  @apply flex items-center gap-2 px-4 py-2.5 rounded-xl
         text-text-primary;
  background: oklch(0.99 0 0 / 0.95);
  backdrop-filter: blur(40px);
  border: 1px solid oklch(0.9 0 0 / 0.6);
  box-shadow: var(--shadow-3);
}
```

---

## §10 — Onboarding Premium

### Problema
Onboarding genérico = primeira impressão genérica. Spark Mail tem um onboarding polido que comunica qualidade.

### Solução
Onboarding com branding, animações e progress indicator:

```tsx
// src/components/onboarding/OnboardingShell.tsx

export function OnboardingShell({ children, step, totalSteps }: Props) {
  return (
    <div className="onboarding-shell">
      {/* Background gradient */}
      <div className="onboarding-bg" />

      {/* Content card */}
      <motion.div
        className="onboarding-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE.out }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <OpenMailLogo size={48} />
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Open Mail
          </h1>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              animate={{
                width: i === step ? 24 : 8,
                height: 8,
                backgroundColor: i <= step
                  ? 'oklch(0.62 0.19 264)'  // accent
                  : 'oklch(0.85 0 0)',       // muted
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <p className="onboarding-footer">
        Open source email for everyone • Made with ♥ for the Linux community
      </p>
    </div>
  );
}
```

```css
.onboarding-shell {
  @apply min-h-screen flex flex-col items-center justify-center relative overflow-hidden;
}

.onboarding-bg {
  @apply absolute inset-0;
  background: 
    radial-gradient(ellipse at 20% 50%, oklch(0.62 0.12 264 / 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, oklch(0.62 0.12 300 / 0.06) 0%, transparent 50%),
    oklch(0.98 0 0);
}

[data-theme='dark'] .onboarding-bg {
  background:
    radial-gradient(ellipse at 20% 50%, oklch(0.4 0.12 264 / 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, oklch(0.4 0.12 300 / 0.1) 0%, transparent 50%),
    oklch(0.12 0 0);
}

.onboarding-card {
  @apply relative z-10 w-full max-w-[480px] p-10;
  background: oklch(1 0 0 / 0.8);
  backdrop-filter: blur(40px);
  border: 1px solid oklch(0.9 0 0 / 0.6);
  border-radius: 24px;
  box-shadow: var(--shadow-4);
}

[data-theme='dark'] .onboarding-card {
  background: oklch(0.16 0 0 / 0.85);
  border: 1px solid oklch(0.3 0 0 / 0.4);
}

.onboarding-footer {
  @apply relative z-10 mt-6 text-xs text-text-tertiary;
}
```

### Provider Selection (Spark-like cards):

```tsx
// src/components/onboarding/ProviderSelect.tsx

const PROVIDERS = [
  { id: 'gmail', name: 'Gmail', icon: GmailIcon, color: '#ea4335', description: 'Google Workspace & Gmail' },
  { id: 'outlook', name: 'Outlook', icon: OutlookIcon, color: '#0078d4', description: 'Microsoft 365 & Outlook.com' },
  { id: 'icloud', name: 'iCloud', icon: AppleIcon, color: '#333', description: 'Apple iCloud Mail' },
  { id: 'other', name: 'Other', icon: Mail, color: '#6366f1', description: 'IMAP / SMTP manual setup' },
];

export function ProviderSelect({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-center text-text-primary">
        Add your email account
      </h2>
      <p className="text-sm text-center text-text-secondary mb-6">
        Choose your email provider to get started
      </p>

      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => (
          <motion.button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className="provider-card"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <provider.icon size={28} style={{ color: provider.color }} />
            <span className="text-sm font-semibold">{provider.name}</span>
            <span className="text-xs text-text-tertiary">{provider.description}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

```css
.provider-card {
  @apply flex flex-col items-center gap-2 p-5 rounded-2xl
         border border-border-default
         hover:border-border-accent hover:shadow-elevation-1
         transition-all duration-150 cursor-pointer;
}
```

---

## §11 — Notification Center

### Problema
Toasts dispersos são efêmeros — o usuário perde notificações se não está olhando.

### Solução
Hub centralizado com histórico + toasts para imediato:

```tsx
// src/stores/useNotificationStore.ts
import { create } from 'zustand';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  undoAction?: () => void;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Notification[];

  notify: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],

  notify: (n) => {
    const notification: Notification = {
      ...n,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    };

    set((s) => ({
      notifications: [notification, ...s.notifications].slice(0, 100),
      toasts: [...s.toasts, notification],
    }));

    // Auto-dismiss toast após 5s (undo após 8s)
    const duration = n.undoAction ? 8000 : 5000;
    setTimeout(() => {
      get().dismissToast(notification.id);
    }, duration);
  },

  dismissToast: (id) => set((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  })),

  markRead: (id) => set((s) => ({
    notifications: s.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    ),
  })),

  markAllRead: () => set((s) => ({
    notifications: s.notifications.map((n) => ({ ...n, read: true })),
  })),

  clear: () => set({ notifications: [] }),
}));
```

```tsx
// src/components/notifications/ToastContainer.tsx
import { AnimatePresence, motion } from 'framer-motion';
import { useNotificationStore } from '@stores/useNotificationStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismiss = useNotificationStore((s) => s.dismissToast);

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="toast-item pointer-events-auto"
            >
              <Icon size={18} className={COLORS[toast.type]} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs text-text-secondary mt-0.5">{toast.message}</p>
                )}
              </div>
              {toast.undoAction && (
                <button
                  onClick={() => {
                    toast.undoAction?.();
                    dismiss(toast.id);
                  }}
                  className="text-xs font-semibold text-text-accent hover:underline"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => dismiss(toast.id)}
                className="p-1 text-text-tertiary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

```css
.toast-item {
  @apply flex items-center gap-3 px-4 py-3 rounded-xl min-w-[320px] max-w-[420px];
  background: oklch(0.99 0 0 / 0.95);
  backdrop-filter: blur(24px);
  border: 1px solid oklch(0.9 0 0 / 0.5);
  box-shadow: var(--shadow-3);
}

[data-theme='dark'] .toast-item {
  background: oklch(0.18 0 0 / 0.95);
  border: 1px solid oklch(0.35 0 0 / 0.4);
}
```

---

## Paleta de Cores Premium (Completa)

A paleta usa **OKLCH** — perceptualmente uniforme, ideal para temas:

```css
/* src/styles/tokens.css */
:root {
  /* === Background === */
  --color-bg-primary: oklch(0.99 0 0);        /* Fundo principal */
  --color-bg-secondary: oklch(0.965 0 0);      /* Sidebar, cards */
  --color-bg-tertiary: oklch(0.94 0 0);        /* Inputs, code blocks */
  --color-bg-hover: oklch(0.93 0 0);           /* Hover state */
  --color-bg-active: oklch(0.90 0 0);          /* Active/pressed */
  --color-bg-selected: oklch(0.93 0.02 264);   /* Item selecionado (tint azul sutil) */

  /* === Text === */
  --color-text-primary: oklch(0.15 0 0);       /* Texto principal */
  --color-text-secondary: oklch(0.45 0 0);     /* Texto secundário */
  --color-text-tertiary: oklch(0.60 0 0);      /* Timestamps, hints */
  --color-text-inverse: oklch(0.99 0 0);       /* Texto em backgrounds escuros */
  --color-text-accent: oklch(0.55 0.19 264);   /* Links, ações */

  /* === Accent (Indigo — premium, neutro, universal) === */
  --color-accent: oklch(0.55 0.19 264);
  --color-accent-hover: oklch(0.50 0.20 264);
  --color-accent-subtle: oklch(0.93 0.03 264); /* Background de badges */

  /* === Borders === */
  --color-border-default: oklch(0.90 0 0);
  --color-border-subtle: oklch(0.94 0 0);
  --color-border-accent: oklch(0.70 0.12 264);

  /* === Semantic === */
  --color-success: oklch(0.60 0.18 155);
  --color-warning: oklch(0.70 0.15 70);
  --color-error: oklch(0.55 0.20 25);
  --color-info: oklch(0.60 0.15 240);

  /* === Unread indicator === */
  --color-unread-dot: oklch(0.55 0.22 264);
  --color-unread-bg: oklch(0.97 0.01 264);
}

[data-theme='dark'] {
  --color-bg-primary: oklch(0.13 0 0);
  --color-bg-secondary: oklch(0.16 0 0);
  --color-bg-tertiary: oklch(0.20 0 0);
  --color-bg-hover: oklch(0.22 0 0);
  --color-bg-active: oklch(0.25 0 0);
  --color-bg-selected: oklch(0.20 0.03 264);

  --color-text-primary: oklch(0.93 0 0);
  --color-text-secondary: oklch(0.65 0 0);
  --color-text-tertiary: oklch(0.50 0 0);
  --color-text-inverse: oklch(0.13 0 0);
  --color-text-accent: oklch(0.70 0.16 264);

  --color-accent: oklch(0.65 0.18 264);
  --color-accent-hover: oklch(0.70 0.19 264);
  --color-accent-subtle: oklch(0.22 0.05 264);

  --color-border-default: oklch(0.25 0 0);
  --color-border-subtle: oklch(0.20 0 0);
  --color-border-accent: oklch(0.50 0.10 264);

  --color-success: oklch(0.65 0.18 155);
  --color-warning: oklch(0.75 0.15 70);
  --color-error: oklch(0.60 0.20 25);
  --color-info: oklch(0.65 0.15 240);

  --color-unread-dot: oklch(0.65 0.20 264);
  --color-unread-bg: oklch(0.17 0.02 264);
}
```

---

## Thread List Item — Design Final (Spark-like)

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  🔵  [Avatar]  Alice Wonderland            2h ago    ⭐  📎  │
│                Re: Project Update — Q4 Planning              │
│                Thanks for the update. I have reviewed the...  │
│                ┌──────┐ ┌─────────┐                          │
│                │Design│ │Marketing│                           │
│                └──────┘ └─────────┘                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

Detalhes visuais:
- **Dot azul** (4px) para unread — pulsante suave
- **Avatar** com gradiente baseado no hash do email
- **Sender name** em semibold, cor primária
- **Timestamp** em tabular-nums, cor terciária
- **Subject** em medium weight, truncado com ellipsis
- **Snippet** em regular, cor secundária, max 2 linhas
- **Labels** como chips pequenos com cor customizada
- **Star** e **attachment icon** como indicadores sutis
- **Hover**: elevation-1 + bg-hover suave
- **Selected**: bg-selected com border-left accent
- **Unread row**: bg-unread-bg (tint sutil)

```tsx
// src/components/thread-list/ThreadListItem.tsx
import { memo } from 'react';
import { motion } from 'framer-motion';
import { Star, Paperclip } from 'lucide-react';
import { Avatar } from '@components/ui/Avatar';
import { cn } from '@lib/utils';
import { formatRelativeDate } from '@lib/date-utils';
import type { ThreadSummary } from '@lib/bindings';

interface Props {
  thread: ThreadSummary;
  isSelected: boolean;
  onSelect: () => void;
}

export const ThreadListItem = memo(function ThreadListItem({
  thread,
  isSelected,
  onSelect,
}: Props) {
  return (
    <div
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 cursor-pointer',
        'border-b border-border-subtle',
        'transition-colors duration-100',
        'hover:bg-[var(--color-bg-hover)]',
        isSelected && 'bg-[var(--color-bg-selected)] border-l-2 border-l-[var(--color-accent)]',
        thread.isUnread && !isSelected && 'bg-[var(--color-unread-bg)]',
      )}
    >
      {/* Unread dot */}
      <div className="flex items-center justify-center w-2 pt-3 flex-shrink-0">
        {thread.isUnread && (
          <motion.div
            className="w-2 h-2 rounded-full bg-[var(--color-unread-dot)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
      </div>

      {/* Avatar */}
      <Avatar
        name={thread.senderName}
        email={thread.senderEmail}
        avatarHash={thread.senderAvatarHash}
        size="sm"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: sender + meta */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sender truncate',
            thread.isUnread && 'font-bold',
          )}>
            {thread.senderName}
            {thread.messageCount > 1 && (
              <span className="text-text-tertiary font-normal ml-1">
                ({thread.messageCount})
              </span>
            )}
          </span>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {thread.isStarred && (
              <Star size={14} className="text-amber-400" fill="currentColor" />
            )}
            {thread.hasAttachments && (
              <Paperclip size={13} className="text-text-tertiary" />
            )}
            <span className="text-timestamp">
              {formatRelativeDate(thread.lastMessageAt)}
            </span>
          </div>
        </div>

        {/* Subject */}
        <p className={cn(
          'text-thread-subject truncate mt-0.5',
          !thread.isUnread && 'font-medium',
        )}>
          {thread.subject}
        </p>

        {/* Snippet */}
        <p className="text-thread-snippet line-clamp-1 mt-0.5">
          {thread.snippet}
        </p>

        {/* Labels */}
        {thread.labelNames.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            {thread.labelNames.map((name, i) => (
              <span
                key={name}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: thread.labelColors[i]
                    ? `${thread.labelColors[i]}20`
                    : 'var(--color-bg-tertiary)',
                  color: thread.labelColors[i] || 'var(--color-text-secondary)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
```

---

## Resumo das Melhorias de Design

| Melhoria | Complexidade | Impacto Visual | Quando |
|----------|-------------|----------------|--------|
| Storybook | Baixa | Médio (DX) | Fase 0 |
| Framer Motion | Média | Alto (premium feel) | Fase 3 |
| Glass Morphism | Baixa | Alto (Spark-like) | Fase 3 |
| Depth System | Baixa | Alto (hierarquia) | Fase 3 |
| Typography Scale | Baixa | Alto (legibilidade) | Fase 3 |
| Custom Scrollbars | Baixa | Médio (polish) | Fase 3 |
| Skeleton Shimmer | Baixa | Alto (percepção velocidade) | Fase 4 |
| Avatar Gradients | Baixa | Alto (personalidade) | Fase 4 |
| Composer Modal | Média | Alto (Spark-like) | Fase 5 |
| Onboarding Premium | Média | Alto (primeira impressão) | Fase 6 |
| Notification Center | Média | Alto (UX completa) | Fase 7 |
| OKLCH Color System | Baixa | Alto (consistência) | Fase 0 |
