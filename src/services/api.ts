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
            const isAuthAction = url.includes('login') || url.includes('logout');

            let defaultMessage = 'Action completed successfully';
            if (isAuthAction && url.includes('login')) defaultMessage = 'Logged in successfully';

            const message = response.data?.message ||
                response.data?.data?.message ||
                (typeof response.data?.status === 'string' ? response.data.status : null) ||
                defaultMessage;

            toast.success(message);
        }

        return response;
    },
    (error) => {
        const { config } = error;
        // @ts-ignore
        const skipToast = config?.skipToast || config?.headers?.['X-Skip-Toast'];
        const response = error.response;
        const status = response?.status;
        const errorData = response?.data;
        const errorMessage = errorData?.message || errorData?.error || error.message || 'An unexpected error occurred';
        const errorCode = errorData?.code || errorData?.error;

        if (status === 401) {
            toast.error('Session expired or unauthorized. Please login again.');
            logout();
            return Promise.reject(error);
        }

        if (status === 403 && (errorCode === 'TOKEN_EXPIRED' || errorCode === 'INVALID_TOKEN')) {
            toast.error('Your session has expired. Please login again.');
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
