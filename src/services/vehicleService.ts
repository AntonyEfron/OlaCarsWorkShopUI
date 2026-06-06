import api from './api';

export interface Vehicle {
    _id: string;
    purchaseDetails: {
        branch?: string | { _id: string; name: string };
        [key: string]: unknown;
    };
    basicDetails: {
        make: string;
        model: string;
        year: number;
        vin: string;
        category?: string;
        fuelType?: string;
        colour?: string;
        odometer?: number;
        [key: string]: unknown;
    };
    status: string;
    currentDriver?: {
        _id: string;
        personalInfo?: {
            fullName: string;
            phone?: string;
            email?: string;
        };
        driverId: string;
    };
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
}

export const getVehicles = async (search?: string): Promise<Vehicle[]> => {
    const params: any = {};
    if (search) params.search = search;
    
    const response = await api.get('/api/vehicle/', {
        params,
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || response.data;
};

export const getVehicleById = async (id: string): Promise<Vehicle> => {
    const response = await api.get(`/api/vehicle/${id}`, {
        // @ts-ignore
        skipToast: true,
    });
    return response.data.data || response.data;
};

export interface DueForServiceVehicle {
    _id: string;
    basicDetails: Vehicle['basicDetails'];
    purchaseDetails: Vehicle['purchaseDetails'];
    status: string;
    currentDriver?: Vehicle['currentDriver'];
    maintenanceDetails?: Record<string, unknown>;
    distanceSinceService: number;
    threshold: number;
    lastServiceOdometer: number;
    percentUsed: number;
    serviceStatus: 'OK' | 'APPROACHING' | 'OVERDUE';
    isPulled?: boolean;
    activeAlertId?: string | null;
}

export interface DueForServicePagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface DueForServiceCounts {
    all: number;
    due: number;
    approaching: number;
    ok: number;
}

export interface DueForServiceResponse {
    data: DueForServiceVehicle[];
    pagination: DueForServicePagination;
    counts: DueForServiceCounts;
}

export const getVehiclesDueForService = async (
    showAll = true,
    page = 1,
    limit = 15,
    filter = 'ALL',
    search = ''
): Promise<DueForServiceResponse> => {
    const response = await api.get('/api/vehicle/due-for-service', {
        params: { 
            showAll: showAll ? 'true' : 'false', 
            warningPercent: 0.8, 
            page, 
            limit,
            filter,
            search
        },
        // @ts-ignore
        skipToast: true,
    });
    return {
        data: response.data.data || [],
        pagination: response.data.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 },
        counts: response.data.counts || { all: 0, due: 0, approaching: 0, ok: 0 },
    };
};
