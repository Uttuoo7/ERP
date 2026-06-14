import { getRequisitions, getPOs, getGRNs, getInvoices } from '../api';

/* ═══════════════════════════════════════════════════════════════════════════
   Enterprise Global Search Registry
   ─────────────────────────────────────────────────────────────────────────
   Each ERP module registers a SearchProvider that maps backend API
   responses to a normalized SearchResult interface.

   Tier Strategy:
     Tier 1: Backend supports ?search= or ?q=   → Server-side filter
     Tier 2: Backend has no search param         → Returns empty + "not supported" flag
     Tier 3: Future unified /search endpoint     → Single aggregated call

   Providers are designed so the UI never needs modification when switching
   from Tier 1/2 to a unified Tier 3 backend search endpoint.
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface SearchResult {
  /** Unique identifier for dedup & routing */
  id: string;
  /** Human-readable title – usually the document number */
  title: string;
  /** Secondary line (e.g. vendor name, description) */
  subtitle: string;
  /** Current status badge text */
  status: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Entity type label (e.g. "Purchase Order") */
  entityType: string;
  /** UI group for section headers */
  group: string;
  /** Route to navigate to on Enter/click */
  route: string;
}

export interface SearchProvider {
  /** Human readable name */
  entityType: string;
  /** UI grouping */
  group: string;
  /** Whether the backend endpoint accepts a search query param */
  supportsSearch: boolean;
  /** Execute the search – must honour AbortSignal for request cancellation */
  search: (query: string, signal: AbortSignal) => Promise<SearchResult[]>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safe(val: any, fallback = '—'): string {
  return val != null && val !== '' ? String(val) : fallback;
}

// ─── Registered Providers ───────────────────────────────────────────────────

export const SEARCH_PROVIDERS: SearchProvider[] = [

  /* ── Purchasing ───────────────────────────────────────────────────────── */

  // Purchase Requisitions – Tier 1: getRequisitions(params) accepts { search }
  {
    entityType: 'Purchase Requisition',
    group: 'Purchasing',
    supportsSearch: true,
    search: async (q, signal) => {
      const res = await getRequisitions({ search: q });
      return (res.data ?? []).map((r: any) => ({
        id: r.id,
        title: safe(r.requisition_number, r.id),
        subtitle: safe(r.department),
        status: safe(r.status),
        updatedAt: safe(r.updated_at),
        entityType: 'Purchase Requisition',
        group: 'Purchasing',
        route: `/requisitions/${r.id}`,
      }));
    },
  },

  // Purchase Orders – Tier 1: getPOs(params) accepts { search }
  {
    entityType: 'Purchase Order',
    group: 'Purchasing',
    supportsSearch: true,
    search: async (q, signal) => {
      const res = await getPOs({ search: q });
      return (res.data ?? []).map((p: any) => ({
        id: p.id,
        title: safe(p.po_number, p.id),
        subtitle: safe(p.vendor?.name || p.vendor_name),
        status: safe(p.status),
        updatedAt: safe(p.updated_at),
        entityType: 'Purchase Order',
        group: 'Purchasing',
        route: `/pos/${p.id}`,
      }));
    },
  },

  /* ── Inventory ────────────────────────────────────────────────────────── */

  // GRNs – Tier 1: getGRNs(params) accepts { search }
  {
    entityType: 'Goods Receipt Note',
    group: 'Inventory',
    supportsSearch: true,
    search: async (q, signal) => {
      const res = await getGRNs({ search: q });
      return (res.data ?? []).map((g: any) => ({
        id: g.id,
        title: safe(g.grn_number, g.id),
        subtitle: safe(g.vendor?.name || g.vendor_name),
        status: safe(g.status),
        updatedAt: safe(g.updated_at),
        entityType: 'Goods Receipt Note',
        group: 'Inventory',
        route: `/grns/${g.id}`,
      }));
    },
  },

  /* ── Finance ──────────────────────────────────────────────────────────── */

  // Invoices – Tier 1: getInvoices(params) accepts { search }
  {
    entityType: 'Invoice',
    group: 'Finance',
    supportsSearch: true,
    search: async (q, signal) => {
      const res = await getInvoices({ search: q });
      return (res.data ?? []).map((i: any) => ({
        id: i.id,
        title: safe(i.invoice_number, i.id),
        subtitle: safe(i.vendor?.name || i.vendor_name),
        status: safe(i.status),
        updatedAt: safe(i.updated_at),
        entityType: 'Invoice',
        group: 'Finance',
        route: `/invoices/${i.id}`,
      }));
    },
  },

  /* ── Master Data (Tier 2 – no server search param) ────────────────── */

  {
    entityType: 'Vendor',
    group: 'Master Data',
    supportsSearch: false,
    search: async () => [],
  },
  {
    entityType: 'Item',
    group: 'Master Data',
    supportsSearch: false,
    search: async () => [],
  },
  {
    entityType: 'Warehouse',
    group: 'Master Data',
    supportsSearch: false,
    search: async () => [],
  },

  /* ── Workflow (Tier 2 – getWorkflowInbox() has no params) ──────────── */

  {
    entityType: 'Workflow Task',
    group: 'Workflow',
    supportsSearch: false,
    search: async () => [],
  },
];

// ─── Core search executor ───────────────────────────────────────────────────

/**
 * Runs all Tier-1 providers concurrently via Promise.allSettled.
 * Tier-2 providers are skipped (they return empty arrays).
 * Returns grouped results keyed by UI group name.
 */
export async function performGlobalSearch(
  query: string,
  signal: AbortSignal,
): Promise<Record<string, SearchResult[]>> {
  const grouped: Record<string, SearchResult[]> = {};

  const tasks = SEARCH_PROVIDERS
    .filter(p => p.supportsSearch)
    .map(async (provider) => {
      try {
        const results = await provider.search(query, signal);
        if (results.length > 0) {
          grouped[provider.group] = (grouped[provider.group] || []).concat(results);
        }
      } catch (e: any) {
        if (e?.name === 'CanceledError' || e?.name === 'AbortError') throw e;
        console.warn(`[GlobalSearch] Provider "${provider.entityType}" failed:`, e);
      }
    });

  await Promise.allSettled(tasks);
  return grouped;
}

/**
 * Returns entity types that do NOT support server-side search,
 * so the UI can display a "not searchable" notice.
 */
export function getUnsupportedEntityTypes(): string[] {
  return SEARCH_PROVIDERS.filter(p => !p.supportsSearch).map(p => p.entityType);
}

// ─── In-memory result cache ─────────────────────────────────────────────────

const searchCache = new Map<string, { ts: number; data: Record<string, SearchResult[]> }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedSearch(query: string): Record<string, SearchResult[]> | null {
  const entry = searchCache.get(query);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  searchCache.delete(query);
  return null;
}

export function setCachedSearch(query: string, data: Record<string, SearchResult[]>): void {
  searchCache.set(query, { ts: Date.now(), data });
}

// ─── Recent searches persistence ────────────────────────────────────────────

const RECENT_SEARCH_KEY = 'erp-global-search-recent';
const MAX_RECENT_SEARCHES = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function pushRecentSearch(query: string): void {
  const list = getRecentSearches().filter(q => q !== query);
  list.unshift(query);
  localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
}
