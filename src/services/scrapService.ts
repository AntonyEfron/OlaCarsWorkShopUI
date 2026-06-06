import api from './api';

export interface ScrapItem {
    _id: string;
    partName: string;
    partNumber?: string;
    quantity: number;
    description?: string;
    status: 'PENDING_DISPOSAL' | 'DISPOSED' | 'RECYCLED' | 'PENDING_SALE_APPROVAL' | 'REJECTED';
    type: 'Valuable' | 'Non Valuable';
    scrappedBy: string;
    scrappedDate: string;
    currentAmount?: number;
    buyerName?: string;
    saleApproved?: boolean;
    rejectionNote?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateScrapInput {
    partName: string;
    partNumber?: string;
    quantity: number;
    description?: string;
    status: 'PENDING_DISPOSAL' | 'DISPOSED' | 'RECYCLED' | 'PENDING_SALE_APPROVAL' | 'REJECTED';
    type: 'Valuable' | 'Non Valuable';
    currentAmount?: number;
    buyerName?: string;
}

export const getScrapItems = async (params: { status?: string; search?: string; type?: string } = {}) => {
    const response = await api.get('/api/scrap', { params });
    return response.data.data || response.data;
};

export const createScrapItem = async (data: CreateScrapInput) => {
    const response = await api.post('/api/scrap', data);
    return response.data.data || response.data;
};

export const updateScrapItem = async (id: string, data: { currentAmount?: number; buyerName?: string; status?: 'PENDING_DISPOSAL' | 'DISPOSED' | 'RECYCLED' | 'PENDING_SALE_APPROVAL' | 'REJECTED'; rejectionNote?: string }) => {
    const response = await api.put(`/api/scrap/${id}`, data);
    return response.data.data || response.data;
};
