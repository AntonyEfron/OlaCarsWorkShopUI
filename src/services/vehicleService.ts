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
