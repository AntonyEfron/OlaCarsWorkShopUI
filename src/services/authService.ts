import api from './api';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    accessToken?: string;
    refreshToken?: string;
    message?: string;
    staff?: Record<string, unknown>;
    [key: string]: unknown;
}

export const workshopStaffLogin = async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/workshop-staff/login', credentials);
    const data = response.data;
    const token = (data.token || data.accessToken) as string;
    return { ...data, token };
};

export const refreshStaffToken = async (token: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/api/workshop-staff/refresh-token', { token });
    return response.data;
};

export const changeStaffPassword = async (
    staffId: string,
    data: { currentPassword: string; newPassword: string }
): Promise<void> => {
    await api.post(`/api/workshop-staff/${staffId}/change-password`, data);
};
