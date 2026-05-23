import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  FileText,
  MessageSquare,
  ShoppingCart,
  Users,
  Package,
  Receipt,
  Inbox,
  Database,
  Warehouse,
  DollarSign,
  Shield,
  Plus,
  ArrowRight,
  Clock,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Command,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   CommandPalette — Enterprise Cmd+K Quick Navigation Overlay
   ─────────────────────────────────────────────────────────────────────────
   • Cmd+K / Ctrl+K keyboard shortcut to open
   • Fuzzy search with grouped results (Pages, Actions, Recent)
   • Full keyboard navigation (↑↓ arrows, Enter, Escape)
   • Glassmorphism backdrop with scale+fade animation
   • Keyboard shortcut hints next to items
   • Accessible: ARIA roles, focus management, screen reader labels
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ──────────────────────────────────────────────────────────────────

type CommandGroup = 'pages' | 'actions' | 'recent';

interface CommandItem {
  id: string;
  label: string;
  group: CommandGroup;
  path: string;
  icon: React.ReactNode;
  shortcut?: string[];
  keywords?: string[];
}

interface CommandPaletteProps {
  /** Additional CSS class on the root portal wrapper */
  className?: string;
}

// ─── Static command registry ────────────────────────────────────────────────

const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

const PAGE_COMMANDS: CommandItem[] = [
  {
    id: 'nav-dashboard',
    label: 'Dashboard',
    group: 'pages',
    path: '/analytics',
    icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    shortcut: ['G', 'D'],
    keywords: ['home', 'analytics', 'overview', 'metrics'],
  },
  {
    id: 'nav-requisitions',
    label: 'Purchase Requisitions',
    group: 'pages',
    path: '/requisitions',
    icon: <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['pr', 'request', 'purchase', 'requisition'],
  },
  {
    id: 'nav-rfqs',
    label: 'RFQs',
    group: 'pages',
    path: '/rfqs',
    icon: <MessageSquare size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['quote', 'quotation', 'rfq', 'request for quotation'],
  },
  {
    id: 'nav-pos',
    label: 'Purchase Orders',
    group: 'pages',
    path: '/pos',
    icon: <ShoppingCart size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['po', 'order', 'purchase order', 'buy'],
  },
  {
    id: 'nav-vendors',
    label: 'Vendors',
    group: 'pages',
    path: '/vendors',
    icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['supplier', 'vendor', 'company'],
  },
  {
    id: 'nav-grns',
    label: 'GRN (Goods Receipt)',
    group: 'pages',
    path: '/grns',
    icon: <Package size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['grn', 'goods', 'receipt', 'receiving', 'warehouse'],
  },
  {
    id: 'nav-invoices',
    label: 'Invoices',
    group: 'pages',
    path: '/invoices',
    icon: <Receipt size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['invoice', 'bill', 'payment', 'ap'],
  },
  {
    id: 'nav-inbox',
    label: 'Workflow Inbox',
    group: 'pages',
    path: '/inbox',
    icon: <Inbox size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['approval', 'task', 'workflow', 'inbox', 'pending'],
  },
  {
    id: 'nav-masters',
    label: 'Master Data',
    group: 'pages',
    path: '/masters',
    icon: <Database size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['master', 'data', 'configuration', 'setup'],
  },
  {
    id: 'nav-inventory',
    label: 'Inventory',
    group: 'pages',
    path: '/inventory',
    icon: <Warehouse size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['stock', 'warehouse', 'inventory', 'ledger'],
  },
  {
    id: 'nav-sales-orders',
    label: 'Sales Orders',
    group: 'pages',
    path: '/sales-orders',
    icon: <DollarSign size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['sales', 'order', 'so', 'revenue'],
  },
  {
    id: 'nav-finance-ledger',
    label: 'Finance Ledger',
    group: 'pages',
    path: '/finance/ledger',
    icon: <DollarSign size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['general ledger', 'gl', 'finance', 'accounting', 'journal'],
  },
  {
    id: 'nav-rbac-matrix',
    label: 'RBAC Matrix',
    group: 'pages',
    path: '/rbac/matrix',
    icon: <Shield size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['rbac', 'role', 'permission', 'access', 'security'],
  },
];

const ACTION_COMMANDS: CommandItem[] = [
  {
    id: 'act-new-pr',
    label: 'New Purchase Requisition',
    group: 'actions',
    path: '/requisitions/new',
    icon: <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    shortcut: ['N', 'R'],
    keywords: ['create', 'new', 'pr', 'requisition'],
  },
  {
    id: 'act-new-rfq',
    label: 'New RFQ',
    group: 'actions',
    path: '/rfqs/new',
    icon: <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['create', 'new', 'rfq', 'quotation'],
  },
  {
    id: 'act-new-po',
    label: 'New Purchase Order',
    group: 'actions',
    path: '/pos/convert',
    icon: <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['create', 'new', 'po', 'purchase order', 'convert'],
  },
  {
    id: 'act-new-invoice',
    label: 'New Invoice',
    group: 'actions',
    path: '/invoices/new',
    icon: <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['create', 'new', 'invoice', 'bill'],
  },
  {
    id: 'act-new-so',
    label: 'New Sales Order',
    group: 'actions',
    path: '/sales-orders/new',
    icon: <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: ['create', 'new', 'sales order', 'so'],
  },
];

const ALL_COMMANDS: CommandItem[] = [...PAGE_COMMANDS, ...ACTION_COMMANDS];

const GROUP_META: Record<CommandGroup, { label: string; icon: React.ReactNode }> = {
  pages: { label: 'Pages', icon: <ArrowRight size={12} strokeWidth={2} /> },
  actions: { label: 'Quick Actions', icon: <Plus size={12} strokeWidth={2} /> },
  recent: { label: 'Recently Visited', icon: <Clock size={12} strokeWidth={2} /> },
};

// ─── Utilities ──────────────────────────────────────────────────────────────

const RECENT_KEY = 'erp-command-palette-recent';
const MAX_RECENT = 5;

function getRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function pushRecent(id: string): void {
  const recent = getRecentIds().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/** Simple fuzzy match — case-insensitive substring on label + keywords */
function fuzzyMatch(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
  // Support multi-word queries: every word must appear somewhere
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Detect Mac platform */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
}

// ─── Component ──────────────────────────────────────────────────────────────

const CommandPalette: React.FC<CommandPaletteProps> = ({ className = '' }) => {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Build filtered & grouped list ──────────────────────────────────────

  const filteredItems = useMemo(() => {
    const recentIds = getRecentIds();

    // Build recent items from ids
    const recentItems: CommandItem[] = recentIds
      .map((id) => ALL_COMMANDS.find((c) => c.id === id))
      .filter((c): c is CommandItem => !!c)
      .map((c) => ({ ...c, group: 'recent' as CommandGroup }));

    // Combine: recent first (only when no query), then pages, then actions
    let candidates: CommandItem[];
    if (query.trim()) {
      // When searching, search all commands (no recent section)
      candidates = ALL_COMMANDS.filter((item) => fuzzyMatch(item, query));
    } else {
      candidates = [...recentItems, ...ALL_COMMANDS];
    }

    return candidates;
  }, [query]);

  // Group items for rendering
  const groupedItems = useMemo(() => {
    const groups: { group: CommandGroup; items: CommandItem[] }[] = [];
    const groupOrder: CommandGroup[] = query.trim() ? ['pages', 'actions'] : ['recent', 'pages', 'actions'];

    for (const g of groupOrder) {
      const items = filteredItems.filter((i) => i.group === g);
      if (items.length > 0) {
        groups.push({ group: g, items });
      }
    }
    return groups;
  }, [filteredItems, query]);

  // Flat list for keyboard navigation index tracking
  const flatItems = useMemo(() => groupedItems.flatMap((g) => g.items), [groupedItems]);

  // ── Clamp active index ─────────────────────────────────────────────────

  useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, activeIndex]);

  // ── Global keyboard listener for Cmd+K / Ctrl+K ───────────────────────

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // ── Focus input when palette opens ─────────────────────────────────────

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Small timeout lets the animation start before focus fires
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // ── Scroll active item into view ───────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const close = useCallback(() => setOpen(false), []);

  const executeItem = useCallback(
    (item: CommandItem) => {
      pushRecent(item.id);
      close();
      navigate(item.path);
    },
    [close, navigate],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[activeIndex]) {
            executeItem(flatItems[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [flatItems, activeIndex, executeItem, close],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) close();
    },
    [close],
  );

  // ── Render helpers ─────────────────────────────────────────────────────

  let runningIndex = 0;

  const modKey = isMac() ? '⌘' : 'Ctrl';

  if (!open) return null;

  return (
    {/* Backdrop overlay */}
    <div
      className={`fixed inset-0 z-[9999] flex items-start justify-center ${className}`}
      style={{
        paddingTop: 'min(20vh, 160px)',
        background: 'hsla(224, 30%, 8%, 0.45)',
        backdropFilter: 'blur(8px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.3)',
        animation: 'cmdpal-backdrop-in var(--duration-normal) var(--ease-out-expo) both',
      }}
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* Palette panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[580px] flex flex-col overflow-hidden"
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl), 0 0 0 1px hsla(0,0%,100%,0.04)',
          maxHeight: 'min(70vh, 520px)',
          animation: 'cmdpal-panel-in var(--duration-normal) var(--ease-out-expo) both',
        }}
      >
        {/* ─── Search input row ─────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4"
          style={{
            borderBottom: '1px solid var(--border-subtle)',
            minHeight: '52px',
          }}
        >
          <Search
            size={18}
            strokeWidth={2}
            style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command or search…"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="cmdpal-list"
            aria-activedescendant={flatItems[activeIndex]?.id}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
            style={{
              color: 'var(--text-primary)',
              caretColor: 'var(--color-primary-400)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider select-none"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* ─── Results list ─────────────────────────────────────────── */}
        <div
          ref={listRef}
          id="cmdpal-list"
          role="listbox"
          aria-label="Command results"
          className="overflow-y-auto flex-1"
          style={{ padding: '6px' }}
        >
          {flatItems.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 py-10"
              role="status"
            >
              <Search size={28} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                No results for "<span style={{ color: 'var(--text-secondary)' }}>{query}</span>"
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>
                Try a different search term
              </p>
            </div>
          ) : (
            groupedItems.map(({ group, items }) => {
              const meta = GROUP_META[group];
              const sectionEl = (
                <div key={group} role="group" aria-label={meta.label}>
                  {/* Group header */}
                  <div
                    className="flex items-center gap-1.5 px-3 pt-3 pb-1.5"
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {meta.icon}
                    {meta.label}
                  </div>

                  {/* Items */}
                  {items.map((item) => {
                    const idx = runningIndex++;
                    const isActive = idx === activeIndex;

                    return (
                      <div
                        key={item.id}
                        id={item.id}
                        role="option"
                        aria-selected={isActive}
                        data-cmd-index={idx}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer select-none group"
                        style={{
                          background: isActive ? 'var(--color-primary-50)' : 'transparent',
                          transition: 'background var(--duration-fast) var(--ease-out-expo)',
                        }}
                      >
                        {/* Icon */}
                        <span
                          className="flex items-center justify-center rounded-md shrink-0"
                          style={{
                            width: '30px',
                            height: '30px',
                            background: isActive
                              ? 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))'
                              : 'var(--surface-2)',
                            color: isActive ? 'var(--text-inverted)' : 'var(--text-secondary)',
                            transition:
                              'background var(--duration-fast) var(--ease-out-expo), color var(--duration-fast) var(--ease-out-expo)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          {item.icon}
                        </span>

                        {/* Label */}
                        <span
                          className="flex-1 text-sm font-medium truncate"
                          style={{
                            color: isActive ? 'var(--color-primary-600)' : 'var(--text-primary)',
                            transition: 'color var(--duration-fast)',
                          }}
                        >
                          {item.label}
                        </span>

                        {/* Shortcut hints or path breadcrumb */}
                        {item.shortcut ? (
                          <span className="hidden sm:flex items-center gap-0.5 shrink-0">
                            {item.shortcut.map((key, ki) => (
                              <kbd
                                key={ki}
                                className="inline-flex items-center justify-center rounded text-[10px] font-bold select-none"
                                style={{
                                  minWidth: '20px',
                                  height: '20px',
                                  padding: '0 4px',
                                  background: isActive ? 'var(--color-primary-100)' : 'var(--surface-3)',
                                  color: isActive ? 'var(--color-primary-600)' : 'var(--text-tertiary)',
                                  border: `1px solid ${isActive ? 'var(--color-primary-200)' : 'var(--border-subtle)'}`,
                                  fontFamily: 'var(--font-sans)',
                                  transition: 'all var(--duration-fast)',
                                }}
                              >
                                {key}
                              </kbd>
                            ))}
                          </span>
                        ) : (
                          <span
                            className="hidden sm:block text-[11px] font-mono truncate shrink-0 max-w-[120px]"
                            style={{
                              color: 'var(--text-tertiary)',
                              opacity: isActive ? 0.8 : 0.5,
                              transition: 'opacity var(--duration-fast)',
                            }}
                          >
                            {item.path}
                          </span>
                        )}

                        {/* Enter hint on active */}
                        {isActive && (
                          <CornerDownLeft
                            size={13}
                            strokeWidth={2}
                            className="hidden sm:block shrink-0"
                            style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
              return sectionEl;
            })
          )}
        </div>

        {/* ─── Footer bar ───────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-4 shrink-0"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            minHeight: '38px',
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <ChevronUp size={11} strokeWidth={2.5} />
              <ChevronDown size={11} strokeWidth={2.5} />
              <span>Navigate</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft size={11} strokeWidth={2.5} />
              <span>Open</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="font-bold" style={{ fontSize: '9px' }}>ESC</span>
              <span>Close</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-1 opacity-60">
            <Command size={11} strokeWidth={2.5} />
            <span>{modKey}+K</span>
          </span>
        </div>
      </div>

      {/* ─── Keyframe animations (injected once) ──────────────────── */}
      <style>{`
        @keyframes cmdpal-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cmdpal-panel-in {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CommandPalette;
