
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://emspartner.espserver.site';

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
        setIsLoading(false); 
        if (!['/login', '/register', '/'].includes(pathname)) {
            router.replace('/login');
        }
    }, [router, pathname]);
    
    const fetchUserProfile = useCallback(async () => {
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!currentToken) {
            logout();
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/user/profile`, {
                headers: { 'Authorization': `Bearer ${currentToken}` }
            });
             if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Profile fetch failed with status ${response.status}: ${errorBody}`);
                logout();
                return;
            }
            const fullProfile: UserProfile = await response.json();
            setUser(fullProfile);
            setIsAdmin(fullProfile.isAdmin);
            setToken(currentToken);

        } catch (error) {
             console.error("Error fetching full user profile:", error);
             logout();
        }
    }, [logout]);
    
    const initializeAuth = useCallback(async () => {
        setIsLoading(true);
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
            try {
                const decoded = jwtDecode<DecodedToken>(tokenFromStorage);
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    await fetchUserProfile();
                }
            } catch (error) {
                console.error("Initialization failed, logging out:", error);
                logout();
            }
        } else {
            // If no token, we are not logged in.
            setIsLoading(false);
        }
        // setLoading(false) should be called inside fetchUserProfile or logout to avoid race conditions.
        // But for the no-token case, it is safe here.
        // For the token case, fetchUserProfile will eventually call setLoading(false) via logout or success.
        // A better approach is to have a final "done" state.
        
        // Let's ensure loading is always turned off.
        const finalizer = () => setIsLoading(false);
        
        if (tokenFromStorage) {
            try {
                const decoded = jwtDecode<DecodedToken>(tokenFromStorage);
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                    finalizer();
                } else {
                    await fetchUserProfile();
                    finalizer();
                }
            } catch (error) {
                console.error("Initialization failed, logging out:", error);
                logout();
                finalizer();
            }
        } else {
            setIsLoading(false);
        }

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
                await fetchUserProfile();
                setIsLoading(false); // Explicitly set loading to false after successful login and profile fetch
                return true;
            }

            throw new Error('Login process failed: No token received.');
        } catch (error: any) {
            console.error('Login error:', error);
            logout(); // This will set loading to false
            throw error;
        }
        // No need for a finally block to set loading false, as logout() does it on error, and we do it on success.
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
