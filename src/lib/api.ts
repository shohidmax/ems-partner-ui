
const servers = [
    'https://emspartner.espserver.site',       // Primary
    'https://emsv2server.maxapi.esp32.site', // Secondary
    'https://ems-partner-server-1.onrender.com', // Backup 1
    'https://ems-partner-server-2.onrender.com', // Backup 2
];

let activeServerIndex = 0;
let apiAuthToken: string | null = null;

export const setApiToken = (token: string | null) => {
    apiAuthToken = token;
};

export const clearApiToken = () => {
    apiAuthToken = null;
};

export const getActiveServer = () => {
    return servers[activeServerIndex];
};

export const setActiveServer = (index: number) => {
    if (index >= 0 && index < servers.length) {
        activeServerIndex = index;
    }
}

const rotateServer = () => {
    activeServerIndex = (activeServerIndex + 1) % servers.length;
    console.warn(`Rotated to next server: ${servers[activeServerIndex]}`);
};

export async function apiFetch<T>(
    path: string, 
    options: RequestInit = {},
    skipAuth: boolean = false
): Promise<{ data: T, response: Response }> {
    const initialServerIndex = activeServerIndex;
    let attempts = 0;

    while (attempts < servers.length) {
        const server = getActiveServer();
        const url = `${server}${path}`;
        
        const headers = new Headers(options.headers || {});
        if (apiAuthToken && !skipAuth) {
            headers.set('Authorization', `Bearer ${apiAuthToken}`);
        }

        try {
            const response = await fetch(url, { ...options, headers });

            if (response.status >= 500) { // Server error, try next server
                throw new Error(`Server error: ${response.status}`);
            }

            const isJson = response.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await response.json() : await response.text();

            if (!response.ok) {
                const errorMessage = (isJson && data.message) ? data.message : (typeof data === 'string' && data) ? data : `Request failed with status ${response.status}`;
                throw new Error(errorMessage);
            }

            // Success, return data
            return { data, response };

        } catch (error) {
            console.error(`Fetch attempt to ${server} failed:`, error);
            attempts++;
            if (attempts < servers.length) {
                rotateServer();
            } else {
                // All servers failed, reset to primary and throw error
                activeServerIndex = initialServerIndex; 
                throw new Error('All servers are currently unavailable. Please try again later.');
            }
        }
    }
    // This should be unreachable
    throw new Error('API fetch failed unexpectedly.');
}
