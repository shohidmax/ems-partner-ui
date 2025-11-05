
'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useToast } from './use-toast';

const API_URL = 'https://espserver3.onrender.com/api/user';

interface UserPayload {
  userId: string;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface UserProfile {
    _id: string;
    name: string;
    email: string;
    devices: string[];
    createdAt: string;
    isAdmin?: boolean;
    photoURL?: string; 
}


export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const fetchUserProfile = async (tokenToVerify: string) => {
      try {
          const response = await fetch(`${API_URL}/profile`, {
              headers: { 'Authorization': `Bearer ${tokenToVerify}` }
          });
          if (!response.ok) throw new Error('Failed to fetch profile');
          const profile: UserProfile = await response.json();
          
          const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com';
          const userIsAdmin = profile.email === adminEmail || profile.isAdmin;

          setUser(profile);
          setToken(tokenToVerify);
          setIsAdmin(userIsAdmin);
          return true;

      } catch (error) {
          console.error('Profile fetch error:', error);
          logout();
          return false;
      }
  }

  const verifyTokenAndFetchUser = useCallback(async (tokenToVerify: string | null) => {
    if (!tokenToVerify) {
      logout();
      return false;
    }
    try {
      const decoded: UserPayload = jwtDecode(tokenToVerify);
      if (decoded.exp * 1000 > Date.now()) {
        return await fetchUserProfile(tokenToVerify);
      }
    } catch (error) {
      console.error('Invalid token:', error);
    }
    logout();
    return false;
  }, []);


  useEffect(() => {
    const initializeUser = async () => {
        setIsLoading(true);
        const tokenFromStorage = localStorage.getItem('token');
        const isValid = await verifyTokenAndFetchUser(tokenFromStorage);

        const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/reset-password';
        const isDashboardPage = pathname.startsWith('/dashboard');

        if (isValid) {
        if (isAuthPage) {
            router.replace('/dashboard');
        }
        } else {
        if (isDashboardPage) {
            router.replace('/login');
        }
        }
        setIsLoading(false);
    };
    initializeUser();
  }, [pathname, router, verifyTokenAndFetchUser]);


  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        await verifyTokenAndFetchUser(data.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    setIsAdmin(false);
  };


  return { user, token, isAdmin, isLoading, login, logout };
}
