import api from './api';

export interface WorkshopStaff {
    _id: string;
    fullName: string;
    email: string;
    phone: string;
    branchId: any;
    role: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
    createdAt?: string;
    updatedAt?: string;
}

export interface PaginationMetadata {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMetadata;
}

export interface StaffFilters {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
    branchId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
}

export interface CreateWorkshopStaffPayload {
    fullName: string;
    email: string;
    password: string;
    phone: string;
    branchId?: string;
    status?: string;
}

export interface UpdateWorkshopStaffPayload {
    id: string;
    fullName?: string;
    email?: string;
    password?: string;
    phone?: string;
    branchId?: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
}

export const getAllStaff = async (filters: StaffFilters = {}): Promise<PaginatedResponse<WorkshopStaff>> => {
    const response = await api.get('/api/workshop-staff', {
        params: filters
    });
    return response.data;
};

export const createStaff = async (
    payload: CreateWorkshopStaffPayload
): Promise<WorkshopStaff> => {
    const response = await api.post('/api/workshop-staff', payload);
    return response.data;
};

export const updateStaff = async (
    payload: UpdateWorkshopStaffPayload
): Promise<WorkshopStaff> => {
    const response = await api.put('/api/workshop-staff/update', payload);
    return response.data;
};

export const deleteStaff = async (id: string): Promise<void> => {
    await api.delete(`/api/workshop-staff/${id}`);
};
