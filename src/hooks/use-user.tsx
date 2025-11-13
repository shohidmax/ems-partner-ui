
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode, type JwtPayload as BaseJwtPayload } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com';
const ADMIN_EMAIL = 'shohidmax@gmail.com'; // Hardcoded admin email

interface JwtPayload extends BaseJwtPayload {
    userId: string;
    email: string;
    name?: string;
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
        router.replace('/login');
    }, [router]);

    const createUserProfileFromToken = (decodedToken: JwtPayload): UserProfile => {
        const userIsAdmin = decodedToken.email === ADMIN_EMAIL;
        setIsAdmin(userIsAdmin);
        return {
            _id: decodedToken.userId,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email.split('@')[0],
            isAdmin: userIsAdmin,
            devices: [], // Devices will be fetched separately on their respective pages
            createdAt: new Date(decodedToken.iat! * 1000).toISOString(),
        };
    };

    const initializeAuth = useCallback(async () => {
        setIsLoading(true);
        const tokenFromStorage = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (tokenFromStorage) {
            try {
                const decoded: JwtPayload = jwtDecode(tokenFromStorage);
                if (decoded.exp && decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    const profile = createUserProfileFromToken(decoded);
                    setUser(profile);
                    setToken(tokenFromStorage);
                }
            } catch (error) {
                console.error("Invalid token during initialization:", error);
                logout();
            }
        }
        setIsLoading(false);
    }, [logout]);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);
    
    useEffect(() => {
        if (isLoading) return;

        const isAuthPage = ['/login', '/register', '/reset-password'].includes(pathname);
        
        if (!user && !isAuthPage) {
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
                if (typeof window !== 'undefined') {
                    localStorage.setItem('token', data.token);
                }
                const decoded: JwtPayload = jwtDecode(data.token);
                const profile = createUserProfileFromToken(decoded);
                
                setUser(profile);
                setToken(data.token);
                setIsLoading(false);
                router.replace(profile.isAdmin ? '/dashboard/admin' : '/dashboard');
                return true;
            }

            throw new Error('No token received');
        } catch (error) {
            console.error('Login error:', error);
            logout();
            setIsLoading(false);
            return false;
        }
    };
    
    // This function will now re-run the initialization logic
    // which is useful for pages that add devices to a user, etc.
    const fetchUserProfile = async () => {
        await initializeAuth();
    }
    
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
