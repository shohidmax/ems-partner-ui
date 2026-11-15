
const getServers = () => {
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return ['http://localhost:3002', 'https://emsedit.maxapi.esp32.site'];
    }
    return ['https://emsedit.maxapi.esp32.site', 'http://localhost:3002'];
};

let activeServerIndex = 0;
let apiAuthToken: string | null = null;

export const setApiToken = (token: string | null) => {
    apiAuthToken = token;
};

export const clearApiToken = () => {
    apiAuthToken = null;
};

export const getActiveServer = () => {
    const s = getServers();
    return s[activeServerIndex % s.length];
};

export const setActiveServer = (index: number) => {
    const s = getServers();
    if (index >= 0 && index < s.length) {
        activeServerIndex = index;
    }
}

const rotateServer = () => {
    const s = getServers();
    activeServerIndex = (activeServerIndex + 1) % s.length;
    console.warn(`Rotated to next server: ${getActiveServer()}`);
};

export async function apiFetch<T>(
    path: string, 
    options: RequestInit = {},
    skipAuth: boolean = false
): Promise<{ data: T, response: Response }> {
    const s = getServers();
    const initialServerIndex = activeServerIndex;
    let attempts = 0;

    while (attempts < s.length) {
        const server = getActiveServer();
        const url = `${server}${path}`;
        
        const headers = new Headers(options.headers || {});
        if (apiAuthToken && !skipAuth) {
            headers.set('Authorization', `Bearer ${apiAuthToken}`);
        }

        try {
            const response = await fetch(url, { ...options, headers });

            let data = null;
            if (response.status !== 204) {
                const isJson = response.headers.get('content-type')?.includes('application/json');
                try {
                    data = isJson ? await response.json() : await response.text();
                } catch (e) {
                    // Ignore parsing errors for empty bodies
                }
            }

            if (!response.ok) {
                const errorMessage = (data && typeof data === 'object' && 'message' in data && data.message) 
                    ? data.message 
                    : (typeof data === 'string' && data) 
                        ? data 
                        : `Request failed with status ${response.status}`;
                throw new Error(errorMessage);
            }

            // Success, return data
            return { data, response };

        } catch (error: any) {
            console.warn(`Fetch attempt to ${server} failed:`, error.message);
            attempts++;
            if (attempts < s.length) {
                rotateServer();
            } else {
                // All servers failed, reset to primary and throw the last encountered error
                activeServerIndex = initialServerIndex; 
                throw new Error(error.message || 'All servers are currently unavailable. Please try again later.');
            }
        }
    }
    // This should be unreachable
    throw new Error('API fetch failed unexpectedly.');
}
