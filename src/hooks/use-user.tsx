
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { apiFetch, setApiToken, clearApiToken } from '@/lib/api';

export interface UserProfile {
    _id: string;
    name: string;
    email: string;
    devices: string[];
    createdAt: string;
    isAdmin: boolean;
    photoURL?: string; 
    address?: string;
    mobile?: string;
}

interface DecodedToken {
    userId: string;
    email: string;
    name: string;
    iat: number;
    exp: number;
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
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const logout = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
        }
        setUser(null);
        setToken(null);
        setIsAdmin(false);
        clearApiToken();
        const isAuthPage = ['/login', '/register', '/reset-password'].includes(pathname);
        if (!isAuthPage && pathname !== '/') {
            router.replace('/login');
        }
    }, [router, pathname]);
    
    const fetchUserProfile = useCallback(async () => {
        try {
            const { data: fullProfile } = await apiFetch<UserProfile>('/api/user/profile');
            setUser(fullProfile);
            setIsAdmin(fullProfile.isAdmin);
        } catch (error) {
             console.error('Error fetching user profile:', error);
             logout();
             throw error; 
        }
    }, [logout]);
    
    const initializeAuth = useCallback(async () => {
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        if (tokenFromStorage) {
            try {
                const decoded = jwtDecode<DecodedToken>(tokenFromStorage);
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setToken(tokenFromStorage);
                    setApiToken(tokenFromStorage);
                    await fetchUserProfile();
                }
            } catch (error) {
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
        const isPublicPage = isAuthPage || pathname === '/';
        
        if (!user && !isPublicPage) {
            router.replace('/login');
        } else if (user && isAuthPage) {
             router.replace(user.isAdmin ? '/dashboard/admin' : '/dashboard');
        }
        
    }, [user, isLoading, pathname, router]);

    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const { data } = await apiFetch<{ token: string }>('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            }, true); // Pass true to skip auth for login

            if (data.token) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('token', data.token);
                }
                setToken(data.token);
                setApiToken(data.token);
                await fetchUserProfile();
                setIsLoading(false);
                return true;
            }

            throw new Error('Login process failed: No token received.');
        } catch (error: any) {
            logout(); 
            setIsLoading(false); 
            throw error;
        }
    };
    
    const value = { 
        user, 
        token, 
        isAdmin, 
        isLoading, 
        login, 
        logout,
        fetchUserProfile,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
