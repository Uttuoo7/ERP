import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ERP_ROUTES } from '../routes/routes.config';
import * as Icons from 'lucide-react';
import {
  Plus,
  ArrowRight,
  Clock,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Command,
  Search,
  Loader2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import {
  performGlobalSearch,
  getCachedSearch,
  setCachedSearch,
  getUnsupportedEntityTypes,
  getRecentSearches,
  pushRecentSearch,
} from '../services/searchRegistry';
import type { SearchResult } from '../services/searchRegistry';

/* ═══════════════════════════════════════════════════════════════════════════
   CommandPalette — Enterprise Cmd+K Global Search & Navigation
   ─────────────────────────────────────────────────────────────────────────
   • Ctrl+K / Cmd+K keyboard shortcut to open
   • Static page & action navigation (always instant)
   • Debounced async ERP-wide entity search via searchRegistry
   • 300ms debounce, request cancellation, 5-min result cache
   • Full keyboard navigation (↑↓ arrows, Enter, Escape)
   • Glassmorphism backdrop with scale+fade animation
   • Tier-2 "search not supported" notice for unindexed entities
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Types ──────────────────────────────────────────────────────────────────

type CommandGroup = string;

interface CommandItem {
  id: string;
  label: string;
  group: CommandGroup;
  path: string;
  icon: React.ReactNode;
  shortcut?: string[];
  keywords?: string[];
  /** For search results: status badge, subtitle */
  meta?: { subtitle?: string; status?: string; entityType?: string };
}

interface CommandPaletteProps {
  className?: string;
}

// ─── Static command registry ────────────────────────────────────────────────

const ICON_SIZE = 16;
const ICON_STROKE = 1.75;

const PAGE_COMMANDS: CommandItem[] = ERP_ROUTES.filter(r => r.searchable).map(r => {
  const IconComponent = (Icons as any)[r.icon] || Icons.Circle;
  return {
    id: `nav-${r.path}`,
    label: r.title,
    group: 'pages',
    path: r.path,
    icon: <IconComponent size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    keywords: [
      r.module.toLowerCase(),
      ...(r.description ? r.description.toLowerCase().split(' ') : [])
    ],
  };
});

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

/** Labels and icons for known groups */
const GROUP_META: Record<string, { label: string; icon: React.ReactNode }> = {
  pages:       { label: 'Pages',            icon: <ArrowRight size={12} strokeWidth={2} /> },
  actions:     { label: 'Quick Actions',    icon: <Plus size={12} strokeWidth={2} /> },
  recent:      { label: 'Recently Visited', icon: <Clock size={12} strokeWidth={2} /> },
  Purchasing:  { label: 'Purchasing',       icon: <FileText size={12} strokeWidth={2} /> },
  Inventory:   { label: 'Inventory',        icon: <FileText size={12} strokeWidth={2} /> },
  Finance:     { label: 'Finance',          icon: <FileText size={12} strokeWidth={2} /> },
  'Master Data': { label: 'Master Data',    icon: <FileText size={12} strokeWidth={2} /> },
  Workflow:    { label: 'Workflow',          icon: <FileText size={12} strokeWidth={2} /> },
};

const DEFAULT_GROUP_META = { label: 'Results', icon: <Search size={12} strokeWidth={2} /> };

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

function fuzzyMatch(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

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

  // Async search state
  const [searchResults, setSearchResults] = useState<Record<string, SearchResult[]>>({});
  const [searchLoading, setSearchLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Static items (pages, actions, recent) ──────────────────────────────

  const staticItems = useMemo(() => {
    if (query.trim()) {
      return ALL_COMMANDS.filter((item) => fuzzyMatch(item, query));
    }
    const recentIds = getRecentIds();
    const recentItems: CommandItem[] = recentIds
      .map((id) => ALL_COMMANDS.find((c) => c.id === id))
      .filter((c): c is CommandItem => !!c)
      .map((c) => ({ ...c, group: 'recent' as CommandGroup }));
    return [...recentItems, ...ALL_COMMANDS];
  }, [query]);

  // ── Convert async search results to CommandItems ──────────────────────

  const searchItems = useMemo((): CommandItem[] => {
    if (!query.trim()) return [];
    const items: CommandItem[] = [];
    Object.entries(searchResults).forEach(([group, results]) => {
      results.forEach((res) => {
        items.push({
          id: `search-${group}-${res.id}`,
          label: res.title,
          group,
          path: res.route,
          icon: <FileText size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
          keywords: [res.subtitle, res.status, res.entityType].filter(Boolean) as string[],
          meta: { subtitle: res.subtitle, status: res.status, entityType: res.entityType },
        });
      });
    });
    return items;
  }, [query, searchResults]);

  // ── Merged flat list for keyboard navigation ──────────────────────────

  const allItems = useMemo(() => [...staticItems, ...searchItems], [staticItems, searchItems]);

  // ── Grouped items for rendering ───────────────────────────────────────

  const groupedItems = useMemo(() => {
    const map: Record<string, CommandItem[]> = {};
    allItems.forEach((item) => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    });

    // Render order: recent first (no query), then static, then search groups
    const staticOrder = query.trim() ? ['pages', 'actions'] : ['recent', 'pages', 'actions'];
    const searchGroups = Object.keys(map).filter(g => !staticOrder.includes(g)).sort();
    const order = [...staticOrder, ...searchGroups];

    return order
      .filter((g) => map[g]?.length)
      .map((g) => ({ group: g, items: map[g] }));
  }, [allItems, query]);

  const flatItems = useMemo(() => groupedItems.flatMap((g) => g.items), [groupedItems]);

  // ── Clamp active index ─────────────────────────────────────────────────

  useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, activeIndex]);

  // ── Global keyboard listener ───────────────────────────────────────────

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

  // ── Debounced global search (300ms) with cancellation & caching ────────

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults({});
      setSearchLoading(false);
      return;
    }

    // Check cache first
    const cached = getCachedSearch(query);
    if (cached) {
      setSearchResults(cached);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(() => {
      performGlobalSearch(query, controller.signal)
        .then((result) => {
          setSearchResults(result);
          setCachedSearch(query, result);
          pushRecentSearch(query);
        })
        .catch((err) => {
          if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
            console.error('[GlobalSearch] Error:', err);
          }
        })
        .finally(() => setSearchLoading(false));
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // ── Focus input on open ────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setSearchResults({});
      requestAnimationFrame(() => inputRef.current?.focus());
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

  // ── Render ─────────────────────────────────────────────────────────────

  let runningIndex = 0;
  const modKey = isMac() ? '⌘' : 'Ctrl';
  const unsupported = getUnsupportedEntityTypes();

  if (!open) return null;

  return (
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
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[580px] flex flex-col overflow-hidden relative"
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
          {searchLoading ? (
            <Loader2
              size={18}
              strokeWidth={2}
              className="animate-spin"
              style={{ color: 'var(--color-primary-500)', flexShrink: 0 }}
            />
          ) : (
            <Search
              size={18}
              strokeWidth={2}
              style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search documents, pages, or actions…"
            aria-label="Global search"
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
          aria-label="Search results"
          className="overflow-y-auto flex-1"
          style={{ padding: '6px' }}
        >
          {flatItems.length === 0 && !searchLoading ? (
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
            <>
              {groupedItems.map(({ group, items }) => {
                const meta = GROUP_META[group] || { ...DEFAULT_GROUP_META, label: group };

                return (
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
                              transition: 'background var(--duration-fast) var(--ease-out-expo), color var(--duration-fast) var(--ease-out-expo)',
                              borderRadius: 'var(--radius-md)',
                            }}
                          >
                            {item.icon}
                          </span>

                          {/* Label + meta */}
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-sm font-medium truncate block"
                              style={{
                                color: isActive ? 'var(--color-primary-600)' : 'var(--text-primary)',
                                transition: 'color var(--duration-fast)',
                              }}
                            >
                              {item.label}
                            </span>
                            {item.meta?.subtitle && (
                              <span
                                className="text-[11px] truncate block"
                                style={{ color: 'var(--text-tertiary)' }}
                              >
                                {item.meta.entityType && (
                                  <span className="font-bold" style={{ marginRight: '6px' }}>{item.meta.entityType}</span>
                                )}
                                {item.meta.subtitle}
                              </span>
                            )}
                          </div>

                          {/* Status badge for search results */}
                          {item.meta?.status && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                              style={{
                                background: isActive ? 'var(--color-primary-100)' : 'var(--surface-2)',
                                color: isActive ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                              }}
                            >
                              {item.meta.status}
                            </span>
                          )}

                          {/* Shortcut hints for static items */}
                          {item.shortcut && !item.meta ? (
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
                          ) : !item.meta ? (
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
                          ) : null}

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
              })}

              {/* Tier-2 notice: entities that don't support server-side search */}
              {query.trim() && unsupported.length > 0 && (
                <div
                  className="flex items-center gap-2 px-4 py-2.5 mt-1 mx-1 rounded-lg"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <AlertTriangle size={13} style={{ color: 'var(--text-tertiary)', opacity: 0.7, flexShrink: 0 }} />
                  <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Search not supported for: {unsupported.join(', ')}
                  </span>
                </div>
              )}

              {/* Loading shimmer for async results */}
              {searchLoading && (
                <div className="flex items-center gap-2 px-4 py-3">
                  <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary-500)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Searching ERP documents...
                  </span>
                </div>
              )}
            </>
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

      {/* ─── Keyframe animations ──────────────────────────────────── */}
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
