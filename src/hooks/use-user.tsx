
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com';
const ADMIN_EMAIL = 'shohidmax@gmail.com'; // Admin email for client-side check

interface JwtPayload {
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
        setIsLoading(false);
        
        const isProtectedPage = pathname.startsWith('/dashboard');
        if (isProtectedPage && typeof window !== 'undefined') {
           router.replace('/login');
        }
    }, [router, pathname]);


    // This function sets user state from a valid token.
    const setUserFromToken = useCallback((currentToken: string) => {
        try {
            const decoded: JwtPayload = jwtDecode(currentToken);
            const userIsAdmin = decoded.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

            const profile: UserProfile = {
                _id: decoded.userId,
                email: decoded.email,
                name: decoded.name || decoded.email.split('@')[0],
                isAdmin: userIsAdmin,
                devices: [], // This can be populated later by specific components if needed
                createdAt: new Date(decoded.iat * 1000).toISOString(),
            };

            setUser(profile);
            setToken(currentToken);
            setIsAdmin(userIsAdmin);
            return true;
        } catch (error) {
            console.error("Invalid token:", error);
            logout();
            return false;
        }
    }, [logout]);


    const initializeAuth = useCallback(async () => {
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
             try {
                const decoded: JwtPayload = jwtDecode(tokenFromStorage);
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    setUserFromToken(tokenFromStorage);
                }
            } catch (error) {
                console.error("Invalid token during initialization:", error);
                logout();
            }
        }
        setIsLoading(false);
    }, [logout, setUserFromToken]);


    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);
    
    useEffect(() => {
        if (isLoading) return;

        const isAuthPage = ['/login', '/register', '/reset-password'].includes(pathname);
        const isHomePage = pathname === '/';
        
        if (!user && !isAuthPage && !isHomePage) {
            router.replace('/login');
        } 
        else if (user && isAuthPage) {
            router.replace(isAdmin ? '/dashboard/admin' : '/dashboard');
        }
        
    }, [user, isAdmin, isLoading, pathname, router]);

    const login = async (email: string, password: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.message || 'Login failed');
            }
            
            const data = await response.json();
            if (data.token) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('token', data.token);
                }
                
                // Directly set user from the new token
                const success = setUserFromToken(data.token);
                setIsLoading(false);
                return success;
            }
             throw new Error('No token received');
        } catch (error) {
            console.error('Login error:', error);
            logout();
            setIsLoading(false);
            return false;
        }
    };
    
    
    // This function can be used to manually re-fetch data if ever needed,
    // but the core auth flow no longer depends on it.
    const fetchUserProfile = async () => {
         const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
         if (currentToken) {
            // In a more complex app, you might fetch non-critical profile data here.
            // For now, we just ensure the user state is set from the token.
            setUserFromToken(currentToken);
         }
    }
    
    const value = { 
        user, 
        token, 
        isAdmin, 
        isLoading, 
        login, 
        logout, 
        fetchUserProfile
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
