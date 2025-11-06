
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com/api/user';

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
    }, []);

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
                setIsAdmin(fullProfile.isAdmin);
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
    
    const fetchUserProfile = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
            await verifyTokenAndSetUser(currentToken);
        }
    }, [verifyTokenAndSetUser]);


    useEffect(() => {
        const tokenFromStorage = localStorage.getItem('token');
        verifyTokenAndSetUser(tokenFromStorage);
    }, []);
    
     useEffect(() => {
        if (isLoading) {
            return; // Do not run redirection logic while loading
        }

        const isAuthPage = ['/login', '/register', '/reset-password'].includes(pathname);
        const isProtectedPage = pathname.startsWith('/dashboard');

        if (!user && isProtectedPage) {
            router.replace('/login');
        } else if (user && isAuthPage) {
            router.replace('/dashboard');
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
            logout();
            return false;
        } catch (error) {
            console.error('Login error:', error);
            logout();
            return false;
        } finally {
             setIsLoading(false);
        }
    };
    
    const value = { user, token, isAdmin, isLoading, login, logout, fetchUserProfile };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
