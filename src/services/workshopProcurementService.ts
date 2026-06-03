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
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_PO' | 'PENDING_FINANCE_APPROVAL';
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
  originalTotalAmount?: number;
  documents?: string[];
  rejectionNote?: string;
  approvalNote?: string;
  createdAt: string;
  updatedAt: string;
}

export const getProcurementRequests = async (params: any = {}) => {
  const response = await api.get('/api/workshop-procurement', {
    params
  });
  return response.data.data || response.data;
};

export const createProcurementRequest = async (data: any) => {
  const response = await api.post('/api/workshop-procurement', data);
  return response.data.data || response.data;
};

export const approveProcurementRequest = async (id: string, data: { status: 'APPROVED' | 'REJECTED', supplier?: string, rejectionReason?: string, quantity?: number }) => {
  const response = await api.put(`/api/workshop-procurement/${id}/approve`, data);
  return response.data.data || response.data;
};
