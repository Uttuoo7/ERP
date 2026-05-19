import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // Assuming FastAPI runs on 8000
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
          const res = await axios.post('http://localhost:8000/api/auth/refresh', {
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
export const getPOs = () => api.get('/pos/');
export const getPO = (id: string) => api.get(`/pos/${id}`);
export const issuePO = (id: string) => api.patch(`/pos/${id}/issue`);
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
export const downloadAttachmentUrl = (id: string) => `http://localhost:8000/api/attachments/download/${id}`;

export const createInvoice = (data: any) => api.post('/invoices/', data);
export const getInvoices = () => api.get('/invoices/');

export const getAnalyticsOverview = (params: any) => api.get('/analytics/overview', { params });
export const getAnalyticsVendorPerformance = (params: any) => api.get('/analytics/vendor-performance', { params });
export const getAnalyticsMonthlyTrends = (params: any) => api.get('/analytics/monthly-trends', { params });
export const getAnalyticsTopItems = (params: any) => api.get('/analytics/top-items', { params });
export const getAnalyticsPOStatusDistribution = () => api.get('/analytics/po-status-distribution');

export default api;
