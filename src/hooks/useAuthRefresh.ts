import { useEffect, useRef, useCallback } from 'react';
import { getDecodedToken, getToken, getRefreshToken, getApiRole, setToken, setRefreshToken, removeToken } from '../utils/auth';
import axios from 'axios';
import toast from 'react-hot-toast';

let isRefreshingGlobal = false;
let refreshPromiseGlobal: Promise<{ accessToken: string } | null> | null = null;

export const performTokenRefresh = async (): Promise<{ accessToken: string } | null> => {
    if (isRefreshingGlobal && refreshPromiseGlobal) {
        return refreshPromiseGlobal;
    }

    const refreshToken = getRefreshToken();
    const apiRole = getApiRole();

    if (!refreshToken || !apiRole) {
        return null;
    }

    isRefreshingGlobal = true;

    refreshPromiseGlobal = (async () => {
        try {
            const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
            const endpoint = apiRole === 'manager' ? '/api/workshop-manager/refresh' : '/api/workshop-staff/refresh';
            
            const response = await axios.post(`${baseURL}${endpoint}`, { refreshToken });
            const data = response.data;

            if (data && (data.token || data.accessToken)) {
                const newAccessToken = (data.token || data.accessToken) as string;
                setToken(newAccessToken);
                
                if (data.refreshToken) {
                    setRefreshToken(data.refreshToken);
                }
                
                toast.success('Session secured: Token refreshed automatically', { id: 'token-refresh', duration: 2000 });
                return { accessToken: newAccessToken };
            }
            
            return null;
        } catch (error) {
            console.error('[AuthRefresh] Failed to refresh token:', error);
            removeToken();
            return null;
        } finally {
            isRefreshingGlobal = false;
            refreshPromiseGlobal = null;
        }
    })();

    return refreshPromiseGlobal;
};

export const useAuthRefresh = () => {
    const lastActivityRef = useRef<number>(Date.now());
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
    }, []);

    const scheduleTokenRefresh = useCallback(() => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }

        const token = getToken();
        if (!token) return;

        const decoded = getDecodedToken();
        if (!decoded?.exp) return;

        const now = Date.now() / 1000;
        const timeUntilExpiry = decoded.exp - now;

        if (timeUntilExpiry <= 0) {
            performTokenRefresh().then(() => scheduleTokenRefresh()).catch(console.error);
            return;
        }

        const lifetime = decoded.iat ? (decoded.exp - decoded.iat) : 900;
        const refreshAtSeconds = lifetime * 0.75;
        const timeElapsed = now - (decoded.iat || (decoded.exp - 900));
        const refreshIn = Math.max((refreshAtSeconds - timeElapsed) * 1000, 2000);

        refreshTimerRef.current = setTimeout(async () => {
            const idleTime = Date.now() - lastActivityRef.current;
            const IDLE_THRESHOLD = 30 * 60 * 1000; // 30 mins

            if (idleTime > IDLE_THRESHOLD) {
                return;
            }

            const currentDecoded = getDecodedToken();
            if (!currentDecoded?.exp) return;

            const currentNow = Date.now() / 1000;
            const currentLifetime = currentDecoded.iat ? (currentDecoded.exp - currentDecoded.iat) : 900;
            const currentRemaining = currentDecoded.exp - currentNow;

            if (currentRemaining > currentLifetime * 0.5) {
                scheduleTokenRefresh();
                return;
            }

            try {
                await performTokenRefresh();
                scheduleTokenRefresh();
            } catch (error) {
                console.error('[AuthRefresh] Proactive refresh failed:', error);
            }
        }, refreshIn);
    }, []);

    useEffect(() => {
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(event => window.addEventListener(event, onActivity, { passive: true }));

        scheduleTokenRefresh();

        return () => {
            events.forEach(event => window.removeEventListener(event, onActivity));
            if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        };
    }, [onActivity, scheduleTokenRefresh]);
};
