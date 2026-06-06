import { jwtDecode } from 'jwt-decode';

export interface DecodedToken {
    id?: string;
    email?: string;
    role: string;
    branchId?: string;
    exp?: number;
    iat?: number;
    [key: string]: unknown;
}

export const getToken = (): string | null => {
    return localStorage.getItem('ws_token');
};

export const setToken = (token: string): void => {
    localStorage.setItem('ws_token', token);
};

export const getRefreshToken = (): string | null => {
    return localStorage.getItem('ws_refreshToken');
};

export const setRefreshToken = (token: string): void => {
    localStorage.setItem('ws_refreshToken', token);
};

export const getApiRole = (): string | null => {
    return localStorage.getItem('ws_apiRole');
};

export const setApiRole = (role: string): void => {
    localStorage.setItem('ws_apiRole', role);
};

export const removeToken = (): void => {
    localStorage.removeItem('ws_token');
    localStorage.removeItem('ws_refreshToken');
    localStorage.removeItem('ws_apiRole');
    localStorage.removeItem('ws_user');
};

import toast from 'react-hot-toast';

export const logout = (): void => {
    removeToken();
    toast.success('Logged out successfully');
    if (window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
};

export const setUser = (user: unknown): void => {
    localStorage.setItem('ws_user', JSON.stringify(user));
};

export const getUser = (): Record<string, unknown> | null => {
    const user = localStorage.getItem('ws_user');
    try {
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
};

export const getDecodedToken = (): DecodedToken | null => {
    const token = getToken();
    if (!token) return null;

    try {
        return jwtDecode<DecodedToken>(token);
    } catch (error) {
        console.error('[auth] Invalid token format:', error);
        return null;
    }
};

export const isTokenValid = (): boolean => {
    const decoded = getDecodedToken();
    const hasRefreshToken = !!getRefreshToken();

    if (!decoded) {
        // If we have no decoded token but we have a refresh token,
        // we tentatively consider it valid and let the interceptor/refresh hook handle it.
        return hasRefreshToken;
    }

    if (decoded.exp) {
        const currentTime = Date.now() / 1000;
        if (decoded.exp < currentTime) {
            // Access token expired, but if we have a refresh token,
            // we trust the refresh mechanism to renew it.
            return hasRefreshToken;
        }
    }

    return true;
};

export const getUserRole = (): string | null => {
    const decoded = getDecodedToken();
    const role = decoded?.role ?? null;
    return typeof role === 'string' ? role.toLowerCase() : null;
};

export const getUserId = (): string | null => {
    const decoded = getDecodedToken();
    return (decoded?.id as string) ?? null;
};

export const getBranchId = (): string | null => {
    const decoded = getDecodedToken();
    return (decoded?.branchId as string) ?? null;
};
