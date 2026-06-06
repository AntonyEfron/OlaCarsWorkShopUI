import api from './api';
import { InventoryPart } from './inventoryService';

export interface WriteOff {
  _id: string;
  requestNumber: string;
  part: InventoryPart;
  quantity: number;
  unitCost: number;
  amountLoss: number;
  reason: string;
  documents?: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  branch: string;
  requestedBy: string;
  requestedByRole: string;
  approvedBy?: string;
  approvedByRole?: string;
  rejectionNote?: string;
  approvalNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWriteOffInput {
  partId: string;
  quantity: number;
  reason: string;
  documents?: string[];
}

export const getWriteOffs = async (params: { status?: string; search?: string } = {}): Promise<WriteOff[]> => {
  const response = await api.get('/api/write-offs', { params });
  return response.data.data || response.data;
};

export const createWriteOff = async (data: CreateWriteOffInput): Promise<WriteOff> => {
  const response = await api.post('/api/write-offs', data);
  return response.data.data || response.data;
};

export const approveWriteOff = async (id: string, approvalNote?: string): Promise<WriteOff> => {
  const response = await api.put(`/api/write-offs/${id}/approve`, { approvalNote });
  return response.data.data || response.data;
};

export const rejectWriteOff = async (id: string, rejectionNote: string): Promise<WriteOff> => {
  const response = await api.put(`/api/write-offs/${id}/reject`, { rejectionNote });
  return response.data.data || response.data;
};
