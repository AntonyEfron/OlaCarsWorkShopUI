import api from './api';

export interface PullMaintenanceResponse {
    success: boolean;
    message: string;
    data: any;
}

export const pullMaintenance = async (vehicleId: string, notes?: string): Promise<PullMaintenanceResponse> => {
    const response = await api.post('/api/alerts/pull-maintenance', {
        vehicleId,
        notes,
    });
    return response.data;
};

export const resolveAlert = async (alertId: string): Promise<any> => {
    const response = await api.put(`/api/alerts/${alertId}/resolve`);
    return response.data;
};
