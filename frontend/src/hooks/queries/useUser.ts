import { useQuery } from '@tanstack/react-query';
import api from "../../api";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export const useUser = () => {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: async (): Promise<User> => {
      const response = await api.get('/auth/me');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};
