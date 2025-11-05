'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { useToast } from './use-toast';

const API_URL = 'https://espserver3.onrender.com/api/user';

interface UserPayload {
  userId: string;
  email: string;
  name: string; // Add name to JWT payload
  iat: number;
  exp: number;
}

// This should match the user object shape from your backend, if available
interface UserProfile {
    _id: string;
    name: string;
    email: string;
    devices: string[];
    createdAt: string;
    isAdmin?: boolean;
    photoURL?: string; // Standard Firebase property, can be adapted
}

// A minimal user object for when the full profile isn't fetched yet.
interface DecodedUser {
    userId: string;
    email: string;
    isAdmin?: boolean;
    photoURL?: string;
    name?: string;
}


export function useUser() {
  const [user, setUser] = useState<DecodedUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const verifyToken = useCallback((tokenToVerify: string | null) => {
    if (!tokenToVerify) {
      setUser(null);
      setToken(null);
      setIsAdmin(false);
      return false;
    }

    try {
      const decoded: UserPayload = jwtDecode(tokenToVerify);
      if (decoded.exp * 1000 > Date.now()) {
        // Here we determine admin status. In a real app, this should
        // come from the JWT payload itself, not be hardcoded.
        const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com';
        const userIsAdmin = decoded.email === adminEmail;
        
        const decodedUser: DecodedUser = {
            userId: decoded.userId,
            email: decoded.email,
            isAdmin: userIsAdmin,
            name: decoded.name || 'User' // Get name from token
        };

        setUser(decodedUser);
        setToken(tokenToVerify);
        setIsAdmin(userIsAdmin);
        return true;
      }
    } catch (error) {
      console.error('Invalid token:', error);
    }

    // If token is invalid or expired, clear everything
    setUser(null);
    setToken(null);
    setIsAdmin(false);
    localStorage.removeItem('token');
    return false;

  }, []);


  useEffect(() => {
    setIsLoading(true);
    const tokenFromStorage = localStorage.getItem('token');
    const isValid = verifyToken(tokenFromStorage);

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
  }, [pathname, router, verifyToken]);


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
        verifyToken(data.token);
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
