
'use client';

import { useState, useEffect, useCallback, createContext, useContext, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com';

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

// This email is the source of truth for admin status on the frontend.
// It MUST match the ADMIN_EMAIL on the backend server for consistency.
const ADMIN_EMAIL = 'shohidmax@gmail.com';

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const isAdmin = useMemo(() => !!user && user.isAdmin, [user]);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
        // This check prevents redirect loops on public pages
        if (typeof window !== 'undefined' && !['/login', '/register', '/reset-password', '/'].includes(pathname)) {
           router.replace('/login');
        }
    }, [router, pathname]);

    const fetchUserProfile = useCallback(async (tokenToVerify: string) => {
        if (!tokenToVerify) {
            logout();
            return;
        }

        try {
            const decoded: UserPayload = jwtDecode(tokenToVerify);
            const isUserAdmin = decoded.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

            // Fetch device list separately, as it's not in the JWT
            const devicesResponse = await fetch(`${API_URL}/api/user/devices`, {
                headers: { 'Authorization': `Bearer ${tokenToVerify}` }
            });

            let userDevices: string[] = [];
            if (devicesResponse.ok) {
                const devicesData: {uid: string}[] = await devicesResponse.json();
                userDevices = devicesData.map(d => d.uid);
            } else {
                 console.warn("Could not fetch user devices, but proceeding with login.");
            }
            
            const profile: UserProfile = {
                _id: decoded.userId,
                email: decoded.email,
                name: decoded.name || 'User',
                isAdmin: isUserAdmin,
                devices: userDevices,
                createdAt: new Date(decoded.iat * 1000).toISOString(),
            };
            
            setUser(profile);
            setToken(tokenToVerify);

        } catch (error) {
            console.error('Error setting up user from token:', error);
            logout();
        }
    }, [logout]);
    
    const initializeAuth = useCallback(async () => {
        setIsLoading(true);
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
            try {
                const decoded: UserPayload = jwtDecode(tokenFromStorage);
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    await fetchUserProfile(tokenFromStorage);
                }
            } catch (e) {
                console.error("Invalid token in storage", e);
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
        
        if (!user && !isAuthPage && !isHomePage) {
            router.replace('/login');
        } else if (user && isAuthPage) {
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
                localStorage.setItem('token', data.token);
                await fetchUserProfile(data.token);

                // We need to decode here again to decide the redirect path immediately
                const decoded: UserPayload = jwtDecode(data.token);
                const userIsAdmin = decoded.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

                router.replace(userIsAdmin ? '/dashboard/admin' : '/dashboard');
                return true;
            }
             throw new Error('No token received');
        } catch (error) {
            console.error('Login error:', error);
            logout();
            return false;
        } finally {
            setIsLoading(false);
        }
    };
    
    const value = { 
        user, 
        token, 
        isAdmin, 
        isLoading, 
        login, 
        logout, 
        fetchUserProfile: () => {
            const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (currentToken) {
                return fetchUserProfile(currentToken);
            }
            return Promise.resolve();
        }
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
