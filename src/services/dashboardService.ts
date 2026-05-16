import api from './api';

export interface WorkshopAnalyticsData {
    workOrderTrends: {
        date: string;
        created: number;
        completed: number;
    }[];
    stockHealth: {
        name: string;
        value: number;
    }[];
}

export const getWorkshopAnalytics = async (branchId?: string, startDate?: string, endDate?: string): Promise<WorkshopAnalyticsData> => {
    const params: any = {};
    if (branchId) params.branch = branchId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await api.get('/api/dashboard/workshop-analytics', { params });
    return response.data.data || response.data;
};
