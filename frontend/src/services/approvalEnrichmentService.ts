import { getRequisition, getPO, getGRN, getInvoice, getRFQ } from '../api';

export interface BusinessContext {
  vendor: string;
  amount: number | null;
  currency: string;
  requestor: string;
  department: string;
  documentStatus: string;
  loaded: boolean;
}

export const defaultContext: BusinessContext = {
  vendor: '—',
  amount: null,
  currency: '—',
  requestor: '—',
  department: '—',
  documentStatus: '—',
  loaded: false
};

/**
 * Enterprise Entity Resolver
 * Resolves raw workflow tasks into enriched business contexts by fetching
 * the underlying PR, PO, GRN, or Invoice from the master tables.
 */
export async function enrichTaskContext(entityId: string | undefined, entityType?: string): Promise<BusinessContext> {
  if (!entityId) return { ...defaultContext };

  try {
    // If entityType is provided by backend, use it for direct routing.
    // Otherwise, attempt a heuristic match (future backend improvement needed).
    const type = entityType?.toUpperCase() || guessTypeFromId(entityId);

    let res;
    switch (type) {
      case 'PR':
      case 'REQUISITION':
        res = await getRequisition(entityId);
        return {
          vendor: '—', // PRs don't have assigned vendors yet
          amount: res.data?.total_value || null,
          currency: res.data?.currency || 'USD',
          requestor: res.data?.requested_by || res.data?.created_by || '—',
          department: res.data?.department || '—',
          documentStatus: res.data?.status || '—',
          loaded: true
        };
      case 'PO':
      case 'PURCHASE_ORDER':
        res = await getPO(entityId);
        return {
          vendor: res.data?.vendor?.name || res.data?.vendor_name || '—',
          amount: res.data?.total_amount || res.data?.total || null,
          currency: res.data?.currency || 'USD',
          requestor: res.data?.buyer || res.data?.created_by || '—',
          department: res.data?.department || '—',
          documentStatus: res.data?.status || '—',
          loaded: true
        };
      case 'INV':
      case 'INVOICE':
        res = await getInvoice(entityId);
        return {
          vendor: res.data?.vendor?.name || res.data?.vendor_name || '—',
          amount: res.data?.invoice_amount || res.data?.total_amount || null,
          currency: res.data?.currency || 'USD',
          requestor: res.data?.submitted_by || '—',
          department: 'Accounts Payable',
          documentStatus: res.data?.status || '—',
          loaded: true
        };
      case 'GRN':
        res = await getGRN(entityId);
        return {
          vendor: res.data?.vendor?.name || res.data?.vendor_name || '—',
          amount: null, // GRNs don't typically have an amount to approve, just quantities
          currency: '—',
          requestor: res.data?.received_by || '—',
          department: 'Warehouse',
          documentStatus: res.data?.status || '—',
          loaded: true
        };
      default:
        return { ...defaultContext };
    }
  } catch (error) {
    console.warn(`Enrichment failed for entity ${entityId}. Fallback to generic context.`);
    return { ...defaultContext };
  }
}

function guessTypeFromId(id: string): string {
  if (id.startsWith('PR-')) return 'PR';
  if (id.startsWith('PO-')) return 'PO';
  if (id.startsWith('INV-')) return 'INV';
  if (id.startsWith('GRN-')) return 'GRN';
  if (id.startsWith('RFQ-')) return 'RFQ';
  return 'UNKNOWN';
}
