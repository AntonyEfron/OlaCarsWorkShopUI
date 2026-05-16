import api from './api';

export type POStatus = 'REQUESTED' | 'MANAGER_APPROVED' | 'WAITING' | 'APPROVED' | 'REJECTED';
export type POPurpose = 'Vehicle' | 'Spare Parts' | 'Others';

export interface PurchaseOrderItem {
    itemName: string;
    quantity: number;
    description?: string;
    unitPrice: number;
}

export interface PurchaseOrder {
    _id: string;
    purchaseOrderNumber: string;
    status: POStatus;
    purpose: POPurpose;
    items: PurchaseOrderItem[];
    totalAmount: number;
    purchaseOrderDate: string;
    branch: any;
    supplier: any;
    createdBy: string;
    creatorRole: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePurchaseOrderPayload {
    purpose: POPurpose;
    items: PurchaseOrderItem[];
    supplier: string;
    branch: string;
}

export const createPurchaseOrder = async (payload: CreatePurchaseOrderPayload): Promise<PurchaseOrder> => {
    const response = await api.post('/api/purchase-order', payload);
    return response.data.data || response.data;
};

export const getPurchaseOrders = async (params: any = {}): Promise<PurchaseOrder[]> => {
    const response = await api.get('/api/purchase-order', { params });
    return response.data.data || response.data;
};

export const approvePurchaseOrder = async (id: string, status: 'MANAGER_APPROVED' | 'REJECTED'): Promise<PurchaseOrder> => {
    const response = await api.put(`/api/purchase-order/${id}/approve`, { status });
    return response.data.data || response.data;
};
