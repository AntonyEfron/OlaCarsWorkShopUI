import api from './api';

export interface ProcurementRequest {
  _id: string;
  requestNumber: string;
  part: {
    _id: string;
    partName: string;
    partNumber: string;
    unitCost: number;
    unit: string;
  };
  quantity: number;
  status: 'PENDING' | 'PENDING_FINANCE_APPROVAL' | 'APPROVED' | 'COST_APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CONVERTED_TO_PO';
  branch: any;
  requestedBy: {
    _id: string;
    fullName: string;
  };
  approvedBy?: {
    _id: string;
    fullName: string;
  };
  rejectionReason?: string;
  supplier?: {
    _id: string;
    name: string;
  };
  notes?: string;
  merchandiserPrice?: number;
  merchandiserTotalAmount?: number;
  receivedQuantity?: number;
  deficitQuantity?: number;
  deficitAmount?: number;
  inventoryAdded?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getProcurementRequests = async (params: any = {}) => {
  const response = await api.get('/api/workshop-procurement', {
    params
  });
  return response.data.data || response.data;
};

export const getProcurementRequestById = async (id: string) => {
  const response = await api.get(`/api/workshop-procurement/${id}`);
  return response.data.data || response.data;
};

export const createProcurementRequest = async (data: any) => {
  const response = await api.post('/api/workshop-procurement', data);
  return response.data.data || response.data;
};

export const approveProcurementRequest = async (id: string, data: { status: 'PENDING_FINANCE_APPROVAL' | 'REJECTED', supplier?: string, rejectionReason?: string, quantity?: number }) => {
  const response = await api.put(`/api/workshop-procurement/${id}/approve`, data);
  return response.data.data || response.data;
};

export const shipProcurementRequest = async (id: string) => {
  const response = await api.put(`/api/workshop-procurement/${id}/ship`);
  return response.data.data || response.data;
};

export const receiveProcurementRequest = async (id: string) => {
  const response = await api.put(`/api/workshop-procurement/${id}/receive`);
  return response.data.data || response.data;
};

export const addInventoryProcurementRequest = async (id: string, data: { receivedQuantity: number }) => {
  const response = await api.put(`/api/workshop-procurement/${id}/add-inventory`, data);
  return response.data.data || response.data;
};
