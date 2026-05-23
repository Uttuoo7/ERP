import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api';
import { useAuthStore } from '../../store/authStore';

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  const login = useAuthStore((state) => state.login);

  return useMutation({
    mutationFn: async (credentials: any) => {
      const response = await api.post('/api/auth/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      // Decode JWT or fetch user details here if needed
      // For now, we mock the user object based on the token
      const token = data.access_token;
      
      // Zustand handles the localStorage and state
      login(token, { id: 1, email: credentials?.email || 'user', role: data.role, username: 'user' });
      
      // Invalidate any queries that depend on auth
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};
