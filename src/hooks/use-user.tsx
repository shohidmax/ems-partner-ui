
'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useToast } from './use-toast';

const API_URL = 'https://espserver3.onrender.com/api/user';
const ADMIN_EMAIL = 'shohidmax@gmail.com';


interface UserPayload {
  userId: string;
  email: string;
  name?: string;
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

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
    setIsAdmin(false);
  }, []);

  const fetchUserProfile = useCallback(async () => {
    const tokenToVerify = localStorage.getItem('token');
    if (!tokenToVerify) return;

    try {
        const response = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${tokenToVerify}` }
        });
        if (response.ok) {
            const fullProfile: UserProfile = await response.json();
            setUser(fullProfile);
            const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ADMIN_EMAIL;
            setIsAdmin(fullProfile.email === adminEmail || !!fullProfile.isAdmin);
        } else {
           console.warn('Could not refetch profile, user data might be stale.');
           logout();
        }
    } catch (error) {
        console.warn('Full profile refetch failed:', error);
        logout();
    }
  }, [logout]);

  const verifyTokenAndSetUser = useCallback(async (tokenToVerify: string | null) => {
    if (!tokenToVerify) {
      logout();
      setIsLoading(false);
      return;
    }
    try {
      const decoded: UserPayload = jwtDecode(tokenToVerify);
      if (decoded.exp * 1000 < Date.now()) {
        logout();
        setIsLoading(false);
        return;
      }
      
      const profileResponse = await fetch(`${API_URL}/profile`, {
          headers: { 'Authorization': `Bearer ${tokenToVerify}` }
      });

      if (profileResponse.ok) {
          const fullProfile: UserProfile = await profileResponse.json();
          setUser(fullProfile);
          setToken(tokenToVerify);
          const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ADMIN_EMAIL;
          setIsAdmin(fullProfile.email === adminEmail || !!fullProfile.isAdmin);
      } else {
          logout();
      }
    } catch (error) {
      console.error('Invalid token or failed to fetch profile:', error);
      logout();
    } finally {
        setIsLoading(false);
    }
  }, [logout]);


  useEffect(() => {
    const tokenFromStorage = localStorage.getItem('token');
    verifyTokenAndSetUser(tokenFromStorage);
  }, [verifyTokenAndSetUser]);
  
  useEffect(() => {
    if (isLoading) {
      return; // Do nothing while loading
    }

    const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/reset-password';
    const isDashboardPage = pathname.startsWith('/dashboard');

    if (user && isAuthPage) {
      router.replace('/dashboard');
    } else if (!user && isDashboardPage) {
      router.replace('/login');
    }
  }, [user, isLoading, pathname, router]);


  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        await verifyTokenAndSetUser(data.token);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
        setIsLoading(false);
    }
  };


  return { user, token, isAdmin, isLoading, login, logout, fetchUserProfile };
}
