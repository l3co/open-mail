# Guia React Pro — Padrões Avançados para o Open Mail

> Cada seção contém: problema identificado, solução proposta, código implementável.
> Foco em React 19, performance, acessibilidade e UX premium.

---

## §1 — Biome ao invés de ESLint + Prettier

### Problema
ESLint + Prettier = 2 ferramentas, configs duplicadas, conflitos frequentes, lento (~3s para lint de 100 arquivos).

### Solução
**Biome** — linter + formatter em um único binário Rust. ~10x mais rápido.

```bash
npm install -D @biomejs/biome
npx biome init
```

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noForEach": "warn",
        "useSimplifiedLogicExpression": "warn"
      },
      "performance": {
        "noAccumulatingSpread": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn",
        "noArrayIndexKey": "warn"
      },
      "correctness": {
        "useExhaustiveDependencies": "warn",
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "useConst": "error",
        "noNonNullAssertion": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
```

```json
// package.json scripts
{
  "scripts": {
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/",
    "format": "biome format --write src/"
  }
}
```

---

## §2 — Command Palette (Cmd+K) estilo Linear/Raycast

### Problema
O roadmap só menciona `Cmd+K` para focar a search bar. Isso é subutilizar um padrão UX poderoso.

### Solução
Command Palette que unifica: navegação, ações, busca, settings — tudo em um lugar.

```bash
npm install cmdk
```

```tsx
// src/components/command-palette/CommandPalette.tsx
import { Command } from 'cmdk';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { 
  Inbox, Send, FileEdit, Trash2, Star, Search, Settings, 
  Plus, Archive, Tag, Mail, User 
} from 'lucide-react';
import { useAccountStore } from '@stores/useAccountStore';
import { useFolderStore } from '@stores/useFolderStore';
import { api } from '@lib/tauri-bridge';
import type { Contact, ThreadSummary } from '@lib/bindings';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ThreadSummary[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const navigate = useNavigate();
  const folders = useFolderStore((s) => s.folders);

  // Registrar atalho global
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Busca debounced
  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      setContacts([]);
      return;
    }

    const timer = setTimeout(async () => {
      const [threadResults, contactResults] = await Promise.all([
        api.threads.search(search, 5),
        api.contacts.search(search, 5),
      ]);
      setResults(threadResults);
      setContacts(contactResults);
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  const runAction = useCallback((action: () => void) => {
    action();
    setOpen(false);
    setSearch('');
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Palette"
      className="command-palette"
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder="Type a command or search..."
        className="command-input"
      />

      <Command.List className="command-list">
        <Command.Empty>No results found.</Command.Empty>

        {/* Quick Actions */}
        {search.length === 0 && (
          <Command.Group heading="Actions">
            <Command.Item onSelect={() => runAction(() => navigate('/compose'))}>
              <Plus size={16} />
              <span>New Email</span>
              <kbd className="command-kbd">⌘N</kbd>
            </Command.Item>
            <Command.Item onSelect={() => runAction(() => navigate('/inbox'))}>
              <Inbox size={16} />
              <span>Go to Inbox</span>
              <kbd className="command-kbd">⌘1</kbd>
            </Command.Item>
            <Command.Item onSelect={() => runAction(() => navigate('/preferences'))}>
              <Settings size={16} />
              <span>Preferences</span>
              <kbd className="command-kbd">⌘,</kbd>
            </Command.Item>
          </Command.Group>
        )}

        {/* Navigation */}
        {search.length === 0 && (
          <Command.Group heading="Navigate">
            {folders.map((folder) => (
              <Command.Item
                key={folder.id}
                onSelect={() => runAction(() => navigate(`/${folder.id}`))}
              >
                <FolderIcon role={folder.role} />
                <span>{folder.name}</span>
                {folder.unreadCount > 0 && (
                  <span className="command-badge">{folder.unreadCount}</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <Command.Group heading="Emails">
            {results.map((thread) => (
              <Command.Item
                key={thread.id}
                onSelect={() => runAction(() => navigate(`/thread/${thread.id}`))}
              >
                <Mail size={16} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{thread.subject}</span>
                  <span className="text-xs text-text-secondary">{thread.senderName}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {/* Contacts */}
        {contacts.length > 0 && (
          <Command.Group heading="Contacts">
            {contacts.map((contact) => (
              <Command.Item
                key={contact.email}
                onSelect={() => runAction(() => navigate(`/compose?to=${contact.email}`))}
              >
                <User size={16} />
                <div className="flex flex-col">
                  <span className="text-sm">{contact.name || contact.email}</span>
                  <span className="text-xs text-text-secondary">{contact.email}</span>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
```

### Estilos do Command Palette (Spark-like):

```css
/* src/styles/command-palette.css */
.command-palette {
  @apply fixed inset-0 z-50 flex items-start justify-center pt-[20vh];
}

.command-palette [cmdk-dialog] {
  @apply w-full max-w-[560px] rounded-2xl border border-white/10
         bg-bg-primary/80 backdrop-blur-2xl shadow-2xl
         overflow-hidden;
  animation: command-slide-in 0.15s ease-out;
}

.command-input {
  @apply w-full px-5 py-4 text-base bg-transparent border-b border-border-default
         text-text-primary placeholder:text-text-tertiary
         outline-none;
}

.command-list {
  @apply max-h-[360px] overflow-y-auto py-2;
}

[cmdk-group-heading] {
  @apply px-4 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wider;
}

[cmdk-item] {
  @apply flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer
         text-text-primary rounded-lg mx-2
         transition-colors duration-100;
}

[cmdk-item][data-selected='true'] {
  @apply bg-bg-hover;
}

.command-kbd {
  @apply ml-auto text-xs text-text-tertiary bg-bg-tertiary
         px-1.5 py-0.5 rounded font-mono;
}

.command-badge {
  @apply ml-auto text-xs bg-bg-accent text-text-inverse
         px-1.5 py-0.5 rounded-full font-medium min-w-[20px] text-center;
}

@keyframes command-slide-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

---

## §3 — Radix UI Primitives para Acessibilidade

### Problema
Construir componentes acessíveis do zero é complexo e propenso a erros (focus trapping, keyboard navigation, ARIA).

### Solução
Usar Radix UI Primitives como base — headless, acessíveis, composáveis:

```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-tooltip @radix-ui/react-context-menu \
  @radix-ui/react-popover @radix-ui/react-switch \
  @radix-ui/react-select @radix-ui/react-scroll-area \
  @radix-ui/react-separator @radix-ui/react-toast
```

### Exemplo: Tooltip Acessível com Estilo Luxuoso

```tsx
// src/components/ui/Tooltip.tsx
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { forwardRef } from 'react';
import { cn } from '@lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-lg px-3 py-1.5 text-xs font-medium',
        'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
        'shadow-lg shadow-black/20',
        'animate-in fade-in-0 zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        'data-[side=bottom]:slide-in-from-top-1',
        'data-[side=top]:slide-in-from-bottom-1',
        'data-[side=left]:slide-in-from-right-1',
        'data-[side=right]:slide-in-from-left-1',
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-gray-900 dark:fill-gray-100" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = 'TooltipContent';
```

### Exemplo: Context Menu (Right-Click em Thread)

```tsx
// src/components/thread-list/ThreadContextMenu.tsx
import * as ContextMenu from '@radix-ui/react-context-menu';
import {
  Archive, Trash2, Star, Mail, MailOpen,
  FolderInput, Tag, Clock, Forward, Reply,
} from 'lucide-react';

interface Props {
  children: React.ReactNode;
  thread: ThreadSummary;
  onAction: (action: string) => void;
}

export function ThreadContextMenu({ children, thread, onAction }: Props) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu">
          <ContextMenu.Item
            className="context-menu-item"
            onSelect={() => onAction('reply')}
          >
            <Reply size={14} />
            <span>Reply</span>
            <span className="context-menu-shortcut">R</span>
          </ContextMenu.Item>

          <ContextMenu.Item
            className="context-menu-item"
            onSelect={() => onAction('forward')}
          >
            <Forward size={14} />
            <span>Forward</span>
            <span className="context-menu-shortcut">F</span>
          </ContextMenu.Item>

          <ContextMenu.Separator className="context-menu-separator" />

          <ContextMenu.Item
            className="context-menu-item"
            onSelect={() => onAction('archive')}
          >
            <Archive size={14} />
            <span>Archive</span>
            <span className="context-menu-shortcut">E</span>
          </ContextMenu.Item>

          <ContextMenu.Item
            className="context-menu-item destructive"
            onSelect={() => onAction('trash')}
          >
            <Trash2 size={14} />
            <span>Move to Trash</span>
            <span className="context-menu-shortcut">#</span>
          </ContextMenu.Item>

          <ContextMenu.Separator className="context-menu-separator" />

          <ContextMenu.Item
            className="context-menu-item"
            onSelect={() => onAction(thread.isUnread ? 'mark-read' : 'mark-unread')}
          >
            {thread.isUnread ? <MailOpen size={14} /> : <Mail size={14} />}
            <span>{thread.isUnread ? 'Mark as Read' : 'Mark as Unread'}</span>
          </ContextMenu.Item>

          <ContextMenu.Item
            className="context-menu-item"
            onSelect={() => onAction('star')}
          >
            <Star size={14} fill={thread.isStarred ? 'currentColor' : 'none'} />
            <span>{thread.isStarred ? 'Unstar' : 'Star'}</span>
            <span className="context-menu-shortcut">S</span>
          </ContextMenu.Item>

          <ContextMenu.Separator className="context-menu-separator" />

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="context-menu-item">
              <FolderInput size={14} />
              <span>Move to...</span>
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent className="context-menu">
              <FolderSubmenu onSelect={(folderId) => onAction(`move:${folderId}`)} />
            </ContextMenu.SubContent>
          </ContextMenu.Sub>

          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className="context-menu-item">
              <Tag size={14} />
              <span>Label...</span>
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent className="context-menu">
              <LabelSubmenu
                threadLabelIds={thread.labelIds}
                onToggle={(labelId) => onAction(`label:${labelId}`)}
              />
            </ContextMenu.SubContent>
          </ContextMenu.Sub>

          <ContextMenu.Item
            className="context-menu-item"
            onSelect={() => onAction('snooze')}
          >
            <Clock size={14} />
            <span>Snooze...</span>
            <span className="context-menu-shortcut">B</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

```css
/* Context Menu Styles */
.context-menu {
  @apply min-w-[220px] rounded-xl p-1.5
         bg-bg-primary/95 backdrop-blur-xl
         border border-border-default
         shadow-xl shadow-black/15
         animate-in fade-in-0 zoom-in-95;
}

.context-menu-item {
  @apply flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg
         cursor-pointer outline-none
         text-text-primary
         data-[highlighted]:bg-bg-hover
         transition-colors duration-75;
}

.context-menu-item.destructive {
  @apply text-red-500 data-[highlighted]:bg-red-50 dark:data-[highlighted]:bg-red-950/30;
}

.context-menu-shortcut {
  @apply ml-auto text-xs text-text-tertiary font-mono;
}

.context-menu-separator {
  @apply my-1.5 h-px bg-border-default;
}
```

---

## §4 — View Transitions para Navegação Fluida

### Problema
Navegar entre folders/threads causa "flash" — conteúdo aparece abruptamente.

### Solução
View Transitions API nativa (Chrome/Edge) + fallback com Framer Motion:

```tsx
// src/hooks/useViewTransition.ts
import { useCallback } from 'react';
import { useNavigate } from 'react-router';

export function useViewTransition() {
  const navigate = useNavigate();

  const navigateWithTransition = useCallback(
    (to: string) => {
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          navigate(to);
        });
      } else {
        navigate(to);
      }
    },
    [navigate],
  );

  return navigateWithTransition;
}
```

```css
/* View Transition styles */
::view-transition-old(root) {
  animation: fade-out 0.15s ease-out;
}

::view-transition-new(root) {
  animation: fade-in 0.15s ease-in;
}

/* Thread list → Message view transition */
::view-transition-old(message-panel) {
  animation: slide-out-right 0.2s ease-out;
}

::view-transition-new(message-panel) {
  animation: slide-in-right 0.2s ease-out;
}

@keyframes slide-in-right {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slide-out-right {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-20px); opacity: 0; }
}
```

---

## §5 — Render-as-you-fetch com Suspense

### Problema
O padrão fetch-on-render (useEffect → fetch → set state) causa waterfalls:
1. Render componente → 2. Inicia fetch → 3. Mostra loading → 4. Re-render com dados

### Solução
Iniciar fetch antes de render, usar Suspense para streaming:

```tsx
// src/lib/suspense-cache.ts

type Status = 'pending' | 'resolved' | 'rejected';

interface CacheEntry<T> {
  status: Status;
  value?: T;
  error?: Error;
  promise?: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function createResource<T>(key: string, fetcher: () => Promise<T>) {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing?.status === 'resolved') return existing.value as T;
  if (existing?.status === 'rejected') throw existing.error;
  if (existing?.status === 'pending') throw existing.promise;

  const promise = fetcher().then(
    (value) => {
      cache.set(key, { status: 'resolved', value });
      return value;
    },
    (error) => {
      cache.set(key, { status: 'rejected', error });
      throw error;
    },
  );

  cache.set(key, { status: 'pending', promise });
  throw promise;
}

export function invalidateResource(key: string) {
  cache.delete(key);
}

export function prefetchResource<T>(key: string, fetcher: () => Promise<T>) {
  if (cache.has(key)) return;
  const promise = fetcher().then(
    (value) => { cache.set(key, { status: 'resolved', value }); },
    (error) => { cache.set(key, { status: 'rejected', error }); },
  );
  cache.set(key, { status: 'pending', promise });
}
```

### Uso: Prefetch ao hover no folder

```tsx
// src/components/layout/Sidebar.tsx
import { prefetchResource } from '@lib/suspense-cache';

function FolderItem({ folder }: { folder: FolderSummary }) {
  const navigateWithTransition = useViewTransition();

  const handleMouseEnter = () => {
    // Prefetch threads ao hover — dados prontos antes do click
    prefetchResource(
      `threads:${folder.id}:0`,
      () => api.threads.listSummaries(folder.accountId, folder.id, 0, 50),
    );
  };

  return (
    <button
      onMouseEnter={handleMouseEnter}
      onClick={() => navigateWithTransition(`/${folder.id}`)}
      className="folder-item"
    >
      <FolderIcon role={folder.role} />
      <span>{folder.name}</span>
      {folder.unreadCount > 0 && <Badge>{folder.unreadCount}</Badge>}
    </button>
  );
}
```

```tsx
// src/components/thread-list/ThreadList.tsx
import { Suspense } from 'react';
import { createResource } from '@lib/suspense-cache';

function ThreadListContent({ folderId, accountId }: Props) {
  // Suspense: se dados não estão prontos, suspende automaticamente
  const threads = createResource(
    `threads:${folderId}:0`,
    () => api.threads.listSummaries(accountId, folderId, 0, 50),
  );

  return (
    <VirtualizedList items={threads}>
      {(thread) => <ThreadListItem key={thread.id} thread={thread} />}
    </VirtualizedList>
  );
}

// Wrapper com Suspense + Error Boundary
export function ThreadList({ folderId, accountId }: Props) {
  return (
    <ErrorBoundary fallback={<ThreadListError />}>
      <Suspense fallback={<ThreadListSkeleton />}>
        <ThreadListContent folderId={folderId} accountId={accountId} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

---

## §6 — Swipe Gestures para Thread List

### Problema
Ações rápidas (archive, delete) requerem cliques precisos ou atalhos memorizados.

### Solução
Swipe gestures (funciona com trackpad no desktop):

```tsx
// src/hooks/useSwipeGesture.ts
import { useRef, useCallback } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipeGesture({ onSwipeLeft, onSwipeRight, threshold = 80 }: SwipeConfig) {
  const startX = useRef(0);
  const currentX = useRef(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const isSwiping = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    currentX.current = e.clientX;
    isSwiping.current = true;
    elementRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isSwiping.current) return;
    currentX.current = e.clientX;
    const diff = currentX.current - startX.current;

    if (elementRef.current) {
      const clamped = Math.max(-threshold * 1.5, Math.min(threshold * 1.5, diff));
      elementRef.current.style.transform = `translateX(${clamped}px)`;
      elementRef.current.style.transition = 'none';

      // Reveal action indicator
      const opacity = Math.min(Math.abs(clamped) / threshold, 1);
      elementRef.current.style.setProperty('--swipe-opacity', String(opacity));
    }
  }, [threshold]);

  const handlePointerUp = useCallback(() => {
    isSwiping.current = false;
    const diff = currentX.current - startX.current;

    if (elementRef.current) {
      elementRef.current.style.transition = 'transform 0.2s ease-out';
      elementRef.current.style.transform = 'translateX(0)';
    }

    if (Math.abs(diff) >= threshold) {
      if (diff < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (diff > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return {
    ref: elementRef,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}
```

```tsx
// Uso no ThreadListItem
function ThreadListItem({ thread }: { thread: ThreadSummary }) {
  const { ref, handlers } = useSwipeGesture({
    onSwipeLeft: () => archiveThread(thread.id),
    onSwipeRight: () => trashThread(thread.id),
  });

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 bg-green-500 flex items-center pl-4"
             style={{ opacity: 'var(--swipe-opacity, 0)' }}>
          <Archive size={20} className="text-white" />
        </div>
        <div className="flex-1 bg-red-500 flex items-center justify-end pr-4"
             style={{ opacity: 'var(--swipe-opacity, 0)' }}>
          <Trash2 size={20} className="text-white" />
        </div>
      </div>

      {/* Thread content */}
      <div ref={ref} {...handlers} className="relative bg-bg-primary">
        <ThreadContent thread={thread} />
      </div>
    </div>
  );
}
```

---

## §7 — CSS Containment para Virtualized Lists

### Problema
Cada thread item no DOM pode causar layout recalculation em toda a lista.

### Solução
CSS Containment instrui o browser a isolar elementos:

```css
/* Thread list item containment */
.thread-list-item {
  contain: content;
  content-visibility: auto;
  contain-intrinsic-size: auto 72px;
}

/* Message view containment */
.message-item {
  contain: layout style;
}

/* Sidebar folder items */
.folder-item {
  contain: content;
  content-visibility: auto;
  contain-intrinsic-size: auto 36px;
}
```

```tsx
// src/components/thread-list/ThreadList.tsx — optimized
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useRef } from 'react';

const ThreadListItem = memo(function ThreadListItem({
  thread,
  isSelected,
  onSelect,
}: ThreadListItemProps) {
  return (
    <div
      className="thread-list-item"
      role="option"
      aria-selected={isSelected}
      data-thread-id={thread.id}
      onClick={onSelect}
    >
      {/* ... content ... */}
    </div>
  );
});

export function ThreadList({ threads }: { threads: ThreadSummary[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
    // Medir tamanho real dos items para variação
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div
      ref={parentRef}
      role="listbox"
      aria-label="Email threads"
      className="flex-1 overflow-y-auto"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const thread = threads[virtualRow.index];
          return (
            <div
              key={thread.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ThreadListItem thread={thread} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## §8 — Shadow DOM para Email Rendering Isolado

### Problema
`dangerouslySetInnerHTML` com HTML de email pode vazar CSS para o app e vice-versa.

### Solução
Shadow DOM para isolar completamente o rendering de email:

```tsx
// src/components/message-list/ShadowEmailBody.tsx
import { useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { open as shellOpen } from '@tauri-apps/plugin-shell';

interface Props {
  html: string;
  onLoadImages?: () => void;
  imagesBlocked?: boolean;
}

export function ShadowEmailBody({ html, onLoadImages, imagesBlocked = true }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<ShadowRoot | null>(null);

  const sanitize = useCallback((rawHtml: string) => {
    let sanitized = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'p', 'br', 'div', 'span', 'a', 'b', 'strong', 'i', 'em', 'u',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'img', 'hr', 'sub', 'sup', 'font', 'center',
        'style',
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'style',
        'width', 'height', 'align', 'valign', 'bgcolor',
        'color', 'face', 'size', 'border', 'cellpadding', 'cellspacing',
        'colspan', 'rowspan', 'target',
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
    });

    // Block remote images if configured
    if (imagesBlocked) {
      sanitized = sanitized.replace(
        /(<img[^>]*\s)src=["']https?:\/\/[^"']+["']/gi,
        '$1data-blocked-src="blocked" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"',
      );
    }

    // Remove tracking pixels (1x1 images)
    sanitized = sanitized.replace(
      /<img[^>]*(?:width=["']1["'][^>]*height=["']1["']|height=["']1["'][^>]*width=["']1["'])[^>]*>/gi,
      '',
    );

    return sanitized;
  }, [imagesBlocked]);

  useEffect(() => {
    if (!hostRef.current) return;

    // Create shadow root once
    if (!shadowRef.current) {
      shadowRef.current = hostRef.current.attachShadow({ mode: 'closed' });
    }

    const shadow = shadowRef.current;
    const sanitized = sanitize(html);

    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-primary, #1f2937);
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        a { color: var(--color-text-accent, #1a73e8); }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; height: auto; }
        blockquote {
          margin: 0.5em 0;
          padding-left: 1em;
          border-left: 3px solid var(--color-border-default, #e5e7eb);
          color: var(--color-text-secondary, #6b7280);
        }
        pre, code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9em;
          background: var(--color-bg-tertiary, #f0f1f3);
          border-radius: 4px;
        }
        pre { padding: 1em; overflow-x: auto; }
        code { padding: 0.2em 0.4em; }
        table { border-collapse: collapse; max-width: 100%; }
        td, th { padding: 4px 8px; }
      </style>
      <div class="email-body">${sanitized}</div>
    `;

    // Intercept link clicks → open in system browser
    shadow.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link?.href) {
        e.preventDefault();
        shellOpen(link.href);
      }
    });
  }, [html, sanitize]);

  return <div ref={hostRef} className="email-shadow-host" />;
}
```

---

## §9 — Slash Commands no TipTap

### Problema
O composer tem uma toolbar, mas power users preferem não tirar as mãos do teclado.

### Solução
Slash commands (`/`) como no Notion/Linear:

```tsx
// src/components/composer/SlashCommand.tsx
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import tippy from 'tippy.js';
import {
  Heading1, Heading2, List, ListOrdered, Code, Quote,
  Image, Link, Minus, Table,
} from 'lucide-react';

const SLASH_COMMANDS = [
  { title: 'Heading 1', icon: Heading1, command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', icon: Heading2, command: ({ editor }) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Bullet List', icon: List, command: ({ editor }) => editor.chain().focus().toggleBulletList().run() },
  { title: 'Numbered List', icon: ListOrdered, command: ({ editor }) => editor.chain().focus().toggleOrderedList().run() },
  { title: 'Code Block', icon: Code, command: ({ editor }) => editor.chain().focus().toggleCodeBlock().run() },
  { title: 'Quote', icon: Quote, command: ({ editor }) => editor.chain().focus().toggleBlockquote().run() },
  { title: 'Divider', icon: Minus, command: ({ editor }) => editor.chain().focus().setHorizontalRule().run() },
  { title: 'Image', icon: Image, command: ({ editor }) => { /* open image picker */ } },
  { title: 'Link', icon: Link, command: ({ editor }) => { /* open link dialog */ } },
];

function SlashCommandList({ items, command }: { items: typeof SLASH_COMMANDS; command: (item: any) => void }) {
  return (
    <div className="slash-menu">
      {items.map((item, index) => (
        <button
          key={item.title}
          className="slash-menu-item"
          onClick={() => command(item)}
        >
          <item.icon size={16} />
          <span>{item.title}</span>
        </button>
      ))}
    </div>
  );
}

export const SlashCommandExtension = Extension.create({
  name: 'slash-command',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          return SLASH_COMMANDS.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          );
        },
        render: () => {
          let component: ReactRenderer;
          let popup: any;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandList, {
                props,
                editor: props.editor,
              });
              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate: (props) => {
              component.updateProps(props);
              popup[0].setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }
              return false;
            },
            onExit: () => {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
```

```css
.slash-menu {
  @apply w-56 rounded-xl p-1.5
         bg-bg-primary/95 backdrop-blur-xl
         border border-border-default
         shadow-xl overflow-hidden;
}

.slash-menu-item {
  @apply flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-lg
         text-text-primary hover:bg-bg-hover
         transition-colors duration-75;
}
```

---

## §10 — AI Autocomplete Hook Point

### Problema
AI no email é o futuro. Precisamos de hooks prontos, mesmo que a feature venha depois.

### Solução
Extensão TipTap com hook point para autocomplete:

```tsx
// src/components/composer/AIAutocomplete.tsx
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface AIProvider {
  getSuggestion(context: string): Promise<string | null>;
}

// Provider nulo por padrão — plugins ou features futuras injetam implementação real
let aiProvider: AIProvider = {
  getSuggestion: async () => null,
};

export function setAIProvider(provider: AIProvider) {
  aiProvider = provider;
}

export const AIAutocompleteExtension = Extension.create({
  name: 'ai-autocomplete',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('ai-autocomplete'),
        props: {
          handleKeyDown(view, event) {
            // Tab aceita sugestão
            if (event.key === 'Tab' && view.dom.querySelector('.ai-suggestion')) {
              event.preventDefault();
              acceptSuggestion(editor);
              return true;
            }
            // Escape rejeita
            if (event.key === 'Escape') {
              dismissSuggestion(editor);
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

// Hook point: trigger de sugestão após pausa de digitação
export function useAIAutocomplete(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;

    let timeout: ReturnType<typeof setTimeout>;

    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        const text = editor.getText();
        if (text.length < 20) return; // mínimo de contexto

        const suggestion = await aiProvider.getSuggestion(text);
        if (suggestion) {
          showGhostText(editor, suggestion);
        }
      }, 1000); // 1s de pausa
    };

    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      clearTimeout(timeout);
    };
  }, [editor]);
}
```

---

## §11 — Smart Recipient Suggestions

### Problema
Autocomplete simples por nome/email não considera contexto. Se estou respondendo a um thread de trabalho, deveria priorizar colegas.

### Solução
Scoring contextual de contatos:

```tsx
// src/lib/smart-recipients.ts

interface ScoredContact {
  contact: Contact;
  score: number;
  reason: string;
}

export function scoreRecipients(
  query: string,
  contacts: Contact[],
  context: RecipientContext,
): ScoredContact[] {
  return contacts
    .map((contact) => {
      let score = 0;
      let reason = '';

      // Base: correspondência textual
      const q = query.toLowerCase();
      if (contact.email.toLowerCase().startsWith(q)) {
        score += 100;
        reason = 'email match';
      } else if (contact.name?.toLowerCase().startsWith(q)) {
        score += 80;
        reason = 'name match';
      } else if (contact.email.toLowerCase().includes(q)) {
        score += 40;
        reason = 'partial match';
      }

      // Boost: contato frequente (emails trocados recentemente)
      if (context.recentContacts.includes(contact.email)) {
        score += 50;
        reason += ' + recent';
      }

      // Boost: mesmo domínio do remetente
      if (context.currentDomain && contact.email.endsWith(`@${context.currentDomain}`)) {
        score += 30;
        reason += ' + same domain';
      }

      // Boost: participante do thread atual
      if (context.threadParticipants?.includes(contact.email)) {
        score += 60;
        reason += ' + thread participant';
      }

      // Penalty: contato sem nome (provavelmente newsletter)
      if (!contact.name) {
        score -= 10;
      }

      return { contact, score, reason };
    })
    .filter((sc) => sc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

interface RecipientContext {
  recentContacts: string[];
  currentDomain?: string;
  threadParticipants?: string[];
}
```

---

## §12 — State Machine com XState para Onboarding

### Problema
O fluxo de onboarding tem muitos estados (escolher provedor, OAuth, IMAP manual, validação, erro, retry). Gerenciar com `useState` vira spaghetti.

### Solução
XState para fluxo de onboarding previsível:

```bash
npm install xstate @xstate/react
```

```tsx
// src/machines/onboardingMachine.ts
import { createMachine, assign } from 'xstate';

interface OnboardingContext {
  provider: string | null;
  email: string;
  imapSettings: ConnectionSettings | null;
  oauthTokens: OAuthTokens | null;
  error: string | null;
  accountId: string | null;
}

type OnboardingEvent =
  | { type: 'SELECT_PROVIDER'; provider: string }
  | { type: 'ENTER_EMAIL'; email: string }
  | { type: 'OAUTH_SUCCESS'; tokens: OAuthTokens }
  | { type: 'OAUTH_FAILURE'; error: string }
  | { type: 'ENTER_IMAP_SETTINGS'; settings: ConnectionSettings }
  | { type: 'VALIDATION_SUCCESS'; accountId: string }
  | { type: 'VALIDATION_FAILURE'; error: string }
  | { type: 'RETRY' }
  | { type: 'BACK' };

export const onboardingMachine = createMachine({
  id: 'onboarding',
  initial: 'welcome',
  context: {
    provider: null,
    email: '',
    imapSettings: null,
    oauthTokens: null,
    error: null,
    accountId: null,
  } satisfies OnboardingContext,

  states: {
    welcome: {
      on: {
        SELECT_PROVIDER: {
          target: 'providerSelected',
          actions: assign({ provider: ({ event }) => event.provider }),
        },
      },
    },

    providerSelected: {
      always: [
        { guard: ({ context }) => context.provider === 'gmail' || context.provider === 'outlook', target: 'oauthFlow' },
        { target: 'manualSetup' },
      ],
    },

    oauthFlow: {
      invoke: {
        src: 'startOAuth',
        onDone: {
          target: 'validating',
          actions: assign({ oauthTokens: ({ event }) => event.output }),
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => event.error?.message || 'OAuth failed' }),
        },
      },
    },

    manualSetup: {
      on: {
        ENTER_EMAIL: {
          actions: assign({ email: ({ event }) => event.email }),
        },
        ENTER_IMAP_SETTINGS: {
          target: 'validating',
          actions: assign({ imapSettings: ({ event }) => event.settings }),
        },
        BACK: 'welcome',
      },
    },

    validating: {
      invoke: {
        src: 'validateConnection',
        onDone: {
          target: 'success',
          actions: assign({ accountId: ({ event }) => event.output }),
        },
        onError: {
          target: 'error',
          actions: assign({ error: ({ event }) => event.error?.message || 'Connection failed' }),
        },
      },
    },

    error: {
      on: {
        RETRY: [
          { guard: ({ context }) => context.provider === 'gmail' || context.provider === 'outlook', target: 'oauthFlow' },
          { target: 'manualSetup' },
        ],
        BACK: 'welcome',
      },
    },

    success: {
      type: 'final',
    },
  },
});
```

```tsx
// src/components/onboarding/Onboarding.tsx
import { useMachine } from '@xstate/react';
import { onboardingMachine } from '@machines/onboardingMachine';
import { AnimatePresence, motion } from 'framer-motion';

export function Onboarding() {
  const [state, send] = useMachine(onboardingMachine, {
    actors: {
      startOAuth: fromPromise(async ({ input }) => {
        return await api.auth.startOAuth(input.provider);
      }),
      validateConnection: fromPromise(async ({ input }) => {
        return await api.accounts.validate(input);
      }),
    },
  });

  return (
    <div className="onboarding-container">
      <AnimatePresence mode="wait">
        {state.matches('welcome') && (
          <motion.div key="welcome" {...pageTransition}>
            <WelcomeStep onSelectProvider={(p) => send({ type: 'SELECT_PROVIDER', provider: p })} />
          </motion.div>
        )}

        {state.matches('oauthFlow') && (
          <motion.div key="oauth" {...pageTransition}>
            <OAuthStep provider={state.context.provider!} />
          </motion.div>
        )}

        {state.matches('manualSetup') && (
          <motion.div key="manual" {...pageTransition}>
            <ManualSetupStep
              onSubmit={(settings) => send({ type: 'ENTER_IMAP_SETTINGS', settings })}
              onBack={() => send({ type: 'BACK' })}
            />
          </motion.div>
        )}

        {state.matches('validating') && (
          <motion.div key="validating" {...pageTransition}>
            <ValidatingStep />
          </motion.div>
        )}

        {state.matches('error') && (
          <motion.div key="error" {...pageTransition}>
            <ErrorStep
              error={state.context.error!}
              onRetry={() => send({ type: 'RETRY' })}
              onBack={() => send({ type: 'BACK' })}
            />
          </motion.div>
        )}

        {state.matches('success') && (
          <motion.div key="success" {...pageTransition}>
            <SuccessStep accountId={state.context.accountId!} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2, ease: 'easeOut' },
};
```

---

## §13 — Hot Module Reload para Plugins

### Problema
Desenvolver plugin requer restart do app a cada mudança.

### Solução
HMR para plugins frontend em modo de desenvolvimento:

```tsx
// src/plugins/dev-loader.ts

const DEV_PLUGIN_WATCHERS = new Map<string, EventSource>();

export function enablePluginHMR(pluginId: string, entryUrl: string) {
  if (import.meta.env.PROD) return;

  // Conectar ao Vite HMR do plugin
  const eventSource = new EventSource(`${entryUrl}/__vite_hmr`);

  eventSource.addEventListener('message', async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'update') {
      console.log(`[Plugin HMR] Reloading ${pluginId}...`);

      // 1. Desativar plugin atual
      await pluginManager.deactivatePlugin(pluginId);

      // 2. Invalidar module cache
      const timestamp = Date.now();
      const freshUrl = `${entryUrl}?t=${timestamp}`;

      // 3. Re-importar e ativar
      const module = await import(/* @vite-ignore */ freshUrl);
      await pluginManager.activatePlugin(pluginId, module.default);

      console.log(`[Plugin HMR] ${pluginId} reloaded successfully`);
    }
  });

  DEV_PLUGIN_WATCHERS.set(pluginId, eventSource);
}
```

---

## Resumo das Melhorias React

| Melhoria | Complexidade | Impacto | Quando |
|----------|-------------|---------|--------|
| Biome | Baixa | Médio (DX, velocidade) | Fase 0 |
| Command Palette | Média | Alto (UX premium) | Fase 3 |
| Radix UI Primitives | Baixa | Alto (acessibilidade) | Fase 3 |
| View Transitions | Baixa | Médio (UX fluida) | Fase 3 |
| Render-as-you-fetch | Média | Alto (percepção de velocidade) | Fase 4 |
| Swipe Gestures | Média | Médio (UX mobile-like) | Fase 4 |
| CSS Containment | Baixa | Alto (performance de scroll) | Fase 4 |
| Shadow DOM email | Média | Alto (segurança + isolation) | Fase 4 |
| Slash Commands | Média | Médio (power user UX) | Fase 5 |
| AI Hook Point | Baixa | Médio (futuro-proof) | Fase 5 |
| Smart Recipients | Média | Alto (UX contextual) | Fase 5 |
| XState Onboarding | Média | Alto (previsibilidade) | Fase 6 |
| Plugin HMR | Baixa | Médio (DX para devs) | Fase 8 |
