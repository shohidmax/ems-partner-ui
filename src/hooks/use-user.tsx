
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
  role?: string;
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
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }, []);

    const fetchUserProfile = useCallback(async (tokenToVerify?: string): Promise<UserProfile | null> => {
        const currentToken = tokenToVerify || token;
        if (!currentToken) {
            return null;
        }

        try {
            const decoded: UserPayload = jwtDecode(currentToken);
            if (decoded.exp * 1000 < Date.now()) {
                throw new Error("Token expired");
            }
            
            const isUserAdmin = decoded.isAdmin === true || decoded.role === 'admin';

            // Admins might not have a device list, or we fetch it from a different endpoint.
            // For now, we fetch devices for all users for simplicity.
            const devicesResponse = await fetch(`${API_URL}/user/devices`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });

            let userDevices: string[] = [];
            if (devicesResponse.ok) {
                const devicesData = await devicesResponse.json();
                userDevices = devicesData.map((d: any) => d.uid);
            }
            
            const profile: UserProfile = {
                _id: decoded.userId,
                name: decoded.name || 'User',
                email: decoded.email,
                isAdmin: isUserAdmin,
                devices: userDevices,
                createdAt: new Date(decoded.iat * 1000).toISOString(),
            };

            setUser(profile);
            setToken(currentToken);
            setIsAdmin(isUserAdmin);

            return profile;

        } catch (error) {
            console.error('Token verification or profile fetch failed:', error);
            logout();
            return null;
        }
    }, [token, logout]);
    
    const initializeAuth = useCallback(async () => {
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
            await fetchUserProfile(tokenFromStorage);
        }
        setIsLoading(false);
    }, [fetchUserProfile]);


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
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                setIsLoading(false);
                return false;
            }
            
            const data = await response.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
                const profile = await fetchUserProfile(data.token);
                 if (profile) {
                    router.push(profile.isAdmin ? '/dashboard/admin' : '/dashboard');
                    return true;
                }
            }
            setIsLoading(false);
            return false;
        } catch (error) {
            console.error('Login error:', error);
            setIsLoading(false);
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
