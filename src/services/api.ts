import axios from 'axios';
import { logout } from '../utils/auth';
import toast from 'react-hot-toast';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: Attach JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('ws_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Variables to handle token refresh queueing
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor: Handle global success/error notifications
api.interceptors.response.use(
    (response) => {
        const { config } = response;
        // @ts-ignore
        const skipToast = config.skipToast || config.headers?.['X-Skip-Toast'];
        const method = (config.method || '').toLowerCase();
        const isMutation = ['post', 'put', 'patch', 'delete'].includes(method);

        if (isMutation && !skipToast) {
            const url = config.url || '';
            const isAuthAction = url.includes('login') || url.includes('logout') || url.includes('refresh');

            let defaultMessage = 'Action completed successfully';
            if (isAuthAction) {
                if (url.includes('login')) defaultMessage = 'Logged in successfully';
                if (url.includes('refresh')) defaultMessage = '';
            }

            const message = response.data?.message ||
                response.data?.data?.message ||
                (typeof response.data?.status === 'string' ? response.data.status : null) ||
                defaultMessage;

            if (message) {
                toast.success(message);
            }
        }

        return response;
    },
    async (error) => {
        const { config } = error;
        // @ts-ignore
        const skipToast = config?.skipToast || config?.headers?.['X-Skip-Toast'];
        const response = error.response;
        const status = response?.status;
        const errorData = response?.data;
        const errorMessage = errorData?.message || errorData?.error || error.message || 'An unexpected error occurred';
        const errorCode = errorData?.code || errorData?.error;

        if (status === 401 || (status === 403 && (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN'))) {
            const originalRequest = config;

            if (originalRequest._retry) {
                toast.error('Session expired. Please login again.');
                logout();
                return Promise.reject(error);
            }

            const refreshToken = localStorage.getItem('ws_refreshToken');
            const apiRole = localStorage.getItem('ws_apiRole');

            if (refreshToken && apiRole) {
                if (isRefreshing) {
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then((token) => {
                            if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
                                originalRequest.headers.set('Authorization', `Bearer ${token}`);
                            } else {
                                originalRequest.headers.Authorization = `Bearer ${token}`;
                            }
                            return api(originalRequest);
                        })
                        .catch((err) => {
                            return Promise.reject(err);
                        });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const { performTokenRefresh } = await import('../hooks/useAuthRefresh');
                    const result = await performTokenRefresh();

                    if (result && result.accessToken) {
                        if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
                            originalRequest.headers.set('Authorization', `Bearer ${result.accessToken}`);
                        } else {
                            originalRequest.headers.Authorization = `Bearer ${result.accessToken}`;
                        }
                        processQueue(null, result.accessToken);
                        return api(originalRequest);
                    } else {
                        throw new Error('No tokens returned from refresh');
                    }
                } catch (err) {
                    processQueue(err, null);
                    toast.error('Session expired. Please login again.');
                    logout();
                    return Promise.reject(err);
                } finally {
                    isRefreshing = false;
                }
            }

            toast.error('Session expired or unauthorized. Please login again.');
            logout();
            return Promise.reject(error);
        }

        if (!skipToast) {
            toast.error(errorMessage);
        }

        return Promise.reject(error);
    }
);

export default api;
