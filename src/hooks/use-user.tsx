
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com';

// This should match the ADMIN_EMAIL in your backend's .env file
const ADMIN_EMAIL = 'shohidmax@gmail.com';

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
    fetchUserProfile: () => Promise<void>; // Kept for compatibility, but now a no-op
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
        // Only redirect if not on a public page
        if (typeof window !== 'undefined' && !['/login', '/register', '/reset-password', '/'].includes(pathname)) {
           router.replace('/login');
        }
    }, [router, pathname]);

    const setupUserFromToken = useCallback((tokenToVerify: string) => {
        try {
            const decoded: JwtPayload = jwtDecode(tokenToVerify);

            if (decoded.exp * 1000 < Date.now()) {
                logout();
                return;
            }

            const userIsAdmin = decoded.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

            const profile: UserProfile = {
                _id: decoded.userId,
                email: decoded.email,
                name: decoded.name || 'User',
                isAdmin: userIsAdmin,
                devices: [], // This will be fetched on specific pages if needed
                createdAt: new Date(decoded.iat * 1000).toISOString(),
            };

            setUser(profile);
            setToken(tokenToVerify);
            setIsAdmin(userIsAdmin);
            return { userIsAdmin };
        } catch (error) {
            console.error('Error setting up user from token:', error);
            logout();
            return { userIsAdmin: false };
        }
    }, [logout]);


    const initializeAuth = useCallback(async () => {
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
            setupUserFromToken(tokenFromStorage);
        }
        
        // This is crucial: set loading to false after attempting to initialize.
        setIsLoading(false);
    }, [setupUserFromToken]);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);
    
    // This effect handles redirection logic after loading is complete.
    useEffect(() => {
        if (isLoading) return;

        const isAuthPage = ['/login', '/register', '/reset-password'].includes(pathname);
        const isHomePage = pathname === '/';
        
        // If not logged in and not on a public page, redirect to login
        if (!user && !isAuthPage && !isHomePage) {
            router.replace('/login');
        } 
        // If logged in and on an auth page, redirect to the appropriate dashboard
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
                // Setup user and get admin status directly after login
                const { userIsAdmin } = setupUserFromToken(data.token);
                
                // Manually redirect after successful login
                router.replace(userIsAdmin ? '/dashboard/admin' : '/dashboard');
                
                return true;
            }
             throw new Error('No token received');
        } catch (error) {
            console.error('Login error:', error);
            logout();
            return false;
        } finally {
            // Set loading to false after the login attempt is complete
            setIsLoading(false);
        }
    };
    
    // This function is now effectively a no-op but kept for compatibility.
    // It prevents errors on pages that might still call it.
    const fetchUserProfile = async () => {
       console.log("fetchUserProfile is deprecated. User profile is now set from token.");
       return Promise.resolve();
    };
    
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
