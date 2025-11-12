
'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'https://espserver3.onrender.com';

// This payload reflects the structure of the JWT token from your server
interface UserPayload {
    userId: string;
    email: string;
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
        // Redirect to login only if not already on a public page
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
            // Directly fetch the user's assigned devices
            const devicesResponse = await fetch(`${API_URL}/api/user/devices`, {
                headers: { 'Authorization': `Bearer ${tokenToVerify}` }
            });
    
            if (!devicesResponse.ok) {
                 // If fetching devices fails, token might be bad, so log out
                throw new Error("Failed to fetch user devices, token might be invalid.");
            }
            
            const devices: { uid: string }[] = await devicesResponse.json();
            const deviceUIDs = devices.map(d => d.uid);
            
            // Decode token to get user info like email and ID
            const decoded: UserPayload = jwtDecode(tokenToVerify);

            // Reconstruct a partial but functional user profile on the client
            const isUserAdmin = decoded.email === 'shohidmax@gmail.com';

            const partialProfile: UserProfile = {
                _id: decoded.userId,
                email: decoded.email,
                name: 'User', // Name is not in token, provide a default
                isAdmin: isUserAdmin,
                devices: deviceUIDs,
                createdAt: new Date(decoded.iat * 1000).toISOString(), // Estimate creation from 'issued at' time
            };
            
            setUser(partialProfile);
            setToken(tokenToVerify);
            setIsAdmin(isUserAdmin);
    
        } catch (error) {
            console.error('Error during profile fetch:', error);
            logout(); // If any part fails, logout for safety
        }
    }, [logout]);
    
    const initializeAuth = useCallback(async () => {
        setIsLoading(true);
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
        
        if (!user && !isAuthPage && !isHomePage) {
            router.replace('/login');
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
                localStorage.setItem('token', data.token);
                await fetchUserProfile(data.token);
                
                // After profile is fetched, determine where to redirect
                const decoded: UserPayload = jwtDecode(data.token);
                const isUserAdmin = decoded.email === 'shohidmax@gmail.com';
                router.replace(isUserAdmin ? '/dashboard/admin' : '/dashboard');

                return true;
            }
             throw new Error('No token received');
        } catch (error) {
            console.error('Login error:', error);
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
            const currentToken = localStorage.getItem('token');
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
