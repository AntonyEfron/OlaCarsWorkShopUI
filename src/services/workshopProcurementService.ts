import api from './api';

export interface ProcurementEditHistory {
  editedAt: string;
  editedBy?: { _id?: string; fullName?: string; name?: string; role?: string };
  editorRole?: string;
  editorName?: string;
  action?: string;
  previousStatus?: string;
  newStatus?: string;
  changesSummary?: string;
  notes?: string;
}

export interface ProcurementRequest {
  _id: string;
  requestNumber: string;
  creationType?: 'PARTS_BASED' | 'VEHICLE_BASED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  technicianName?: string;
  isNewItem?: boolean;
  itemCode?: string;
  partNumber?: string;
  partName?: string;
  category?: 'Engine' | 'Electrical' | 'Suspension' | 'Lubricants' | 'Consumables' | 'Body' | 'Tyres' | 'Other';
  unitOfMeasure?: string;
  fullSizePhoto?: string;
  closeUpPhoto?: string;

  // Vehicle details
  vin?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  plateNumber?: string;

  part?: {
    _id: string;
    partName: string;
    partNumber: string;
    unitCost: number;
    unit: string;
    itemCode?: string;
    category?: string;
  };
  quantity: number;
  status: 'PENDING' | 'RETURNED_TO_TECHNICIAN' | 'APPROVED' | 'PENDING_FINANCE_APPROVAL' | 'COST_APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED' | 'CONVERTED_TO_PO' | 'WAITING_QUOTATION';
  branch: any;
  requestedBy: {
    _id: string;
    fullName?: string;
    name?: string;
  };
  approvedBy?: {
    _id: string;
    fullName?: string;
    name?: string;
  };
  rejectionReason?: string;
  returnReason?: string;

  // Sourcing & Logistics
  preferredSupplier?: {
    _id: string;
    name: string;
  };
  preferredSupplierName?: string;
  preferredBrand?: string;
  qualityPreference?: 'GENUINE_OEM' | 'AFTERMARKET_ANY_BRAND';
  transportationMode?: 'SEA' | 'AIR' | 'LAND';

  // Verification
  isInformationVerified?: boolean;
  verifiedBy?: { _id?: string; fullName?: string; name?: string };
  verifiedByName?: string;
  verifiedAt?: string;

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
  surplusQuantity?: number;
  surplusAmount?: number;
  ledgerEntries?: any[];
  inventoryAdded?: boolean;
  editHistory?: ProcurementEditHistory[];
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

export const createProcurementRequest = async (data: FormData | any) => {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const response = await api.post('/api/workshop-procurement', data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
  });
  return response.data.data || response.data;
};

export const approveProcurementRequest = async (id: string, data: any) => {
  const response = await api.put(`/api/workshop-procurement/${id}/approve`, data);
  return response.data.data || response.data;
};

export const resubmitProcurementRequest = async (id: string, data: FormData | any) => {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const response = await api.put(`/api/workshop-procurement/${id}/resubmit`, data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
  });
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
