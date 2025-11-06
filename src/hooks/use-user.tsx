
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com/api';

interface UserPayload {
  userId: string;
  email: string;
  name?: string;
  isAdmin?: boolean;
  iat: number;
  exp: number;
}

export interface UserProfile {
    _id: string;
    name: string;
    email: string;
    devices: string[];
    createdAt: string;
    isAdmin: boolean;
    photoURL?: string; 
}

interface UserContextType {
    user: UserProfile | null;
    token: string | null;
    isAdmin: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    fetchUserProfile: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
        setIsAdmin(false);
        window.location.href = '/login';
    }, []);

    const fetchUserProfile = useCallback(async (tokenToVerify: string): Promise<UserProfile | null> => {
        try {
            const decoded: UserPayload = jwtDecode(tokenToVerify);
            if (decoded.exp * 1000 < Date.now()) {
                throw new Error("Token expired");
            }

            const profileResponse = await fetch(`${API_URL}/user/profile`, {
                headers: { 'Authorization': `Bearer ${tokenToVerify}` }
            });

            if (!profileResponse.ok) {
                const errorData = await profileResponse.text();
                console.error("Profile fetch failed with status:", profileResponse.status, "and data:", errorData);
                throw new Error("Failed to fetch user profile");
            }
            
            const fullProfile: UserProfile = await profileResponse.json();
            return fullProfile;

        } catch (error) {
            console.error('Token verification or profile fetch failed:', error);
            return null;
        }
    }, []);
    
    const initializeAuth = useCallback(async () => {
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
            const profile = await fetchUserProfile(tokenFromStorage);
            if (profile) {
                setUser(profile);
                setToken(tokenFromStorage);
                setIsAdmin(profile.isAdmin);
            } else {
                logout();
            }
        }
        setIsLoading(false);
    }, [fetchUserProfile, logout]);


    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);
    
     useEffect(() => {
        if (isLoading) return;

        const isAuthPage = ['/login', '/register', '/reset-password'].includes(pathname);
        const isHomePage = pathname === '/';
        
        if (user) {
            if (isAuthPage || isHomePage) {
                router.replace(isAdmin ? '/dashboard/admin' : '/dashboard');
            }
        } else {
            if (!isAuthPage && !isHomePage) {
                 router.replace('/login');
            }
        }
    }, [user, isAdmin, isLoading, pathname, router]);

    const login = async (email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_URL}/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
                // After storing the token, force a hard reload to ensure clean state
                window.location.href = '/dashboard';
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    };
    
    const value = { user, token, isAdmin, isLoading, login, logout, fetchUserProfile: () => initializeAuth() };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
