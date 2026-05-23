import { useQuery } from '@tanstack/react-query';
import api from '../../api';

interface POQueryParams {
  search?: string;
  status_filter?: string;
}

export const usePurchaseOrders = (params?: POQueryParams) => {
  return useQuery({
    queryKey: ['purchaseOrders', params],
    queryFn: async () => {
      const response = await api.get('/api/po', { params });
      return response.data;
    },
  });
};
