import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${BASE_URL}/api`, // Use env var if present, else fallback to proxy
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // Dynamic URL for token refresh
          const res = await axios.post(`${BASE_URL || window.location.origin}/api/auth/refresh`, {
            refresh_token: refreshToken
          });
          
          if (res.data.access_token) {
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('refresh_token', res.data.refresh_token);
            
            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${res.data.access_token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, user needs to login again
        localStorage.clear();
        window.location.href = '/login';
      }
    } else {
      // Global toast for errors
      if (error.response) {
        const errorMsg = error.response.data?.detail || error.response.data?.message || "An unexpected error occurred.";
        toast.error(`Error: ${errorMsg}`);
      } else {
        toast.error("Network error. Please check backend server.");
      }
    }
    return Promise.reject(error);
  }
);

export const login = (data: any) => api.post('/auth/login', data);

export const getVendors = () => api.get('/vendors/');
export const createVendor = (data: any) => api.post('/vendors/', data);
export const updateVendor = (id: string, data: any) => api.put(`/vendors/${id}`, data);
export const getItems = () => api.get('/items/');
export const createItem = (data: any) => api.post('/items/', data);
export const updateItem = (id: string, data: any) => api.put(`/items/${id}`, data);
export const getWarehouses = () => api.get('/warehouses/');
export const createPO = (data: any) => api.post('/pos/', data);
export const updatePO = (id: string, data: any) => api.put(`/pos/${id}`, data);
export const getPOs = (params?: any) => api.get('/pos/', { params });
export const getPO = (id: string) => api.get(`/pos/${id}`);
export const issuePO = (id: string) => api.patch(`/pos/${id}/issue`);
export const convertRFQToPO = (data: any) => api.post('/pos/convert-rfq', data);
export const submitPOForApproval = (id: string) => api.post(`/pos/${id}/submit`);
export const amendPO = (id: string, changeReason: string) => api.post(`/pos/${id}/amend`, { change_reason: changeReason });
export const getPOAmendments = (id: string) => api.get(`/pos/${id}/amendments`);
export const updatePOVendor = (id: string, vendorId: string) => api.patch(`/pos/${id}?vendor_id=${vendorId}`);
export const createGRN = (data: any) => api.post('/grns/', data);

export const getSOs = () => api.get('/sales-orders/');
export const getSO = (id: string) => api.get(`/sales-orders/${id}`);
export const createSO = (data: any) => api.post('/sales-orders/', data);
export const updateSO = (id: string, data: any) => api.put(`/sales-orders/${id}`, data);
export const approveSO = (id: string) => api.patch(`/sales-orders/${id}/approve`);
export const convertSOtoPO = (id: string) => api.post(`/sales-orders/${id}/convert-to-po`);

export const uploadAttachment = (data: FormData) => api.post('/attachments/upload', data, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const getAttachments = (sourceType: string, id: string) => api.get(`/attachments/${sourceType}/${id}`);
export const downloadAttachmentUrl = (id: string) => `${BASE_URL || window.location.origin}/api/attachments/download/${id}`;

export const createInvoice = (data: any) => api.post('/invoices/', data);
export const getInvoices = (params?: any) => api.get('/invoices/', { params });
export const getInvoice = (id: string) => api.get(`/invoices/${id}`);
export const runInvoiceMatch = (id: string) => api.post(`/invoices/${id}/run-match`);
export const resolveInvoiceVariance = (id: string, resolutions: any) => api.post(`/invoices/${id}/resolve-variance`, resolutions);
export const postInvoiceGL = (id: string) => api.post(`/invoices/${id}/post-ledger`);

export const getAnalyticsOverview = (params: any) => api.get('/analytics/overview', { params });
export const getAnalyticsVendorPerformance = (params: any) => api.get('/analytics/vendor-performance', { params });
export const getAnalyticsMonthlyTrends = (params: any) => api.get('/analytics/monthly-trends', { params });
export const getAnalyticsTopItems = (params: any) => api.get('/analytics/top-items', { params });
export const getAnalyticsPOStatusDistribution = () => api.get('/analytics/po-status-distribution');

// -- Executive command center callers --
export const getAnalyticsCommandCenter = () => api.get('/analytics/command-center');
export const getAnalyticsProcurement = () => api.get('/analytics/procurement');
export const getAnalyticsInventory = () => api.get('/analytics/inventory');
export const getAnalyticsFinance = () => api.get('/analytics/finance');
export const getAnalyticsWorkflow = () => api.get('/analytics/workflow');
export const getAnalyticsVendors = () => api.get('/analytics/vendors');
export const triggerAnalyticsSnapshot = () => api.post('/analytics/snapshot/trigger');

// -- Dynamic Master Data Callers --
export const getMasterList = (entity: string, params: any) => api.get(`/masters/${entity}/`, { params });
export const getMasterItem = (entity: string, id: string) => api.get(`/masters/${entity}/${id}`);
export const createMasterItem = (entity: string, data: any) => api.post(`/masters/${entity}/`, data);
export const updateMasterItem = (entity: string, id: string, data: any) => api.put(`/masters/${entity}/${id}`, data);
export const deleteMasterItem = (entity: string, id: string) => api.delete(`/masters/${entity}/${id}`);
export const bulkImportMaster = (entity: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post(`/masters/${entity}/bulk-import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const exportMasterUrl = (entity: string) => `${BASE_URL || window.location.origin}/api/masters/${entity}/export`;

// -- Workflow Engine Callers --
export const getWorkflowDefinitions = () => api.get('/workflow/definitions');
export const createWorkflowDefinition = (data: any) => api.post('/workflow/definitions', data);
export const getWorkflowInbox = () => api.get('/workflow/inbox');
export const actionWorkflowTask = (taskId: string, action: 'APPROVED' | 'REJECTED', comments?: string) => 
  api.post(`/workflow/tasks/${taskId}/action`, { action, comments });
export const getWorkflowHistory = (entityId: string) => api.get(`/workflow/history/${entityId}`);

// -- Purchase Requisitions (PR) Callers --
export const getRequisitions = (params?: any) => api.get('/pos/requisitions/', { params });
export const getRequisition = (id: string) => api.get(`/pos/requisitions/${id}`);
export const createRequisition = (data: any) => api.post('/pos/requisitions/', data);
export const updateRequisition = (id: string, data: any) => api.put(`/pos/requisitions/${id}`, data);
export const submitRequisition = (id: string) => api.post(`/pos/requisitions/${id}/submit`);
export const duplicateRequisition = (id: string) => api.post(`/pos/requisitions/${id}/duplicate`);
export const addRequisitionComment = (id: string, comment: string) => api.post(`/pos/requisitions/${id}/comments`, { comment });

// -- Universal Document Traceability Callers --
export const getDocumentLineage = (docType: string, docId: string) => api.get(`/traceability/lineage/${docType}/${docId}`);

// -- Request For Quotation (RFQ) Callers --
export const getRFQs = (params?: any) => api.get('/pos/rfqs/', { params });
export const getRFQ = (id: string) => api.get(`/pos/rfqs/${id}`);
export const createRFQFromPR = (data: any) => api.post('/pos/rfqs/from-pr', data);
export const inviteRFQVendors = (id: string, vendorIds: string[]) => api.post(`/pos/rfqs/${id}/invite`, { vendor_ids: vendorIds });
export const submitRFQQuotation = (id: string, vendorId: string, data: any) => api.post(`/pos/rfqs/${id}/quotations?vendor_id=${vendorId}`, data);
export const getRFQComparison = (id: string) => api.get(`/pos/rfqs/${id}/compare`);
export const selectRFQVendor = (id: string, vendorId: string) => api.post(`/pos/rfqs/${id}/select-vendor`, { vendor_id: vendorId });

// -- Universal Inventory Engine Callers --
export const getInventoryBalances = (params?: any) => api.get('/inventory/balances', { params });
export const getStockLedger = (params?: any) => api.get('/inventory/ledger', { params });
export const getInventoryBatches = (params?: any) => api.get('/inventory/batches', { params });
export const getInventorySerials = (params?: any) => api.get('/inventory/serials', { params });
export const adjustStock = (data: any) => api.post('/inventory/adjust', data);

// -- Goods Receipt Notes (GRN) Callers --
export const getGRNs = (params?: any) => api.get('/grns/', { params });
export const getGRN = (id: string) => api.get(`/grns/${id}`);
export const convertPOToGRN = (data: any) => api.post('/grns/convert-po', data);
export const submitGRNQC = (id: string, data: any) => api.post(`/grns/${id}/qc-submit`, data);

// -- Universal Financial Layer Callers --
export const getLiabilities = (params?: any) => api.get('/finance/liabilities', { params });
export const getPayablesAging = () => api.get('/finance/aging');
export const getFinancialLedger = (params?: any) => api.get('/finance/ledger', { params });
export const getTallySyncQueue = (params?: any) => api.get('/finance/tally/queue', { params });
export const syncAllTally = () => api.post('/finance/tally/sync-all');
export const recordVendorPayment = (data: any) => api.post('/finance/payments', data);
export const postInvoiceVoucher = (invoiceId: string) => api.post(`/finance/invoices/${invoiceId}/post-voucher`);

// -- RBAC & Security Audit Callers --
export const getUserPermissions = () => api.get('/auth/rbac/permissions');
export const getRBACMatrix = () => api.get('/auth/rbac/matrix');
export const getRBACUsers = () => api.get('/auth/rbac/users');
export const assignUserRole = (data: any) => api.post('/auth/rbac/assign', data);
export const getSecurityAuditLogs = () => api.get('/auth/rbac/audit-logs');

// -- Central Notification Alerts Callers --
export const getNotifications = (unreadOnly: boolean) => api.get('/notifications/', { params: { unread_only: unreadOnly } });
export const getUnreadNotificationsCount = () => api.get('/notifications/unread-count');
export const markAllNotificationsRead = () => api.post('/notifications/read-all');
export const markNotificationRead = (id: string) => api.post(`/notifications/${id}/read`);

// -- Analytical Exports Gateways --
export const exportPOsUrl = () => `${BASE_URL || window.location.origin}/api/reports/pos`;
export const exportLiabilitiesUrl = () => `${BASE_URL || window.location.origin}/api/reports/liabilities`;
export const exportMismatchesUrl = () => `${BASE_URL || window.location.origin}/api/reports/mismatches`;

// -- Enterprise Document Generation Callers --
export const generateDocument = (documentType: string, referenceId: string) => api.post(`/documents/generate/${documentType}/${referenceId}`);
export const getLatestDocumentUrl = (documentType: string, referenceId: string) => api.get(`/documents/${documentType}/${referenceId}/latest`);

export default api;
