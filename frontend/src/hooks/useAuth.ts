import { create } from 'zustand';

interface User {
  id: number;
  username: string;
  fullname: string;
  role: string;
  role_id: number;
  branch_id?: number | null;
  branch_name?: string | null;
  profile_pic: string | null;
  phone?: string | null;
  mustChangePassword?: boolean;
  isVerified?: boolean;
}

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const getUserFromStorage = () => {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getUserFromStorage(),
  isAuthenticated: !!localStorage.getItem('token'),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));
