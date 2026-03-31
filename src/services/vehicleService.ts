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
    createdAt: string;
    updatedAt: string;
    [key: string]: unknown;
}

export const getVehicles = async (): Promise<Vehicle[]> => {
    const response = await api.get('/api/vehicle/', {
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
