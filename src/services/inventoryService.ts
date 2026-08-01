import api from './api';

export type PartCategory =
  | 'Engine' | 'Transmission' | 'Brakes' | 'Suspension' | 'Electrical'
  | 'Body' | 'Tyres' | 'Fluids' | 'Filters' | 'Belts' | 'Cooling'
  | 'Exhaust' | 'Interior' | 'Parts' | 'Other';

export type UnitType = 'piece' | 'litre' | 'kg' | 'metre' | 'set' | 'pair' | 'box';

export interface InventoryPart {
  _id: string;
  partName: string;
  partNumber: string;
  category: PartCategory;
  description?: string;
  unit: UnitType;
  unitCost: number;
  quantityOnHand: number;
  quantityReserved: number;
  quantityBlocked?: number;
  isBlocked?: boolean;
  blockedReason?: string;
  quantityAvailable: number; // Virtual
  reorderLevel: number;
  branchId: string;
  supplierId?: string;
  lastRestockedAt?: string;
  isActive: boolean;
  isLowStock: boolean; // Virtual
  createdAt: string;
  updatedAt: string;
  inventoryAccountId?: any;
  purchaseAccountId?: any;
  incomeAccountId?: any;
  taxId?: any;
}

export interface PartTransaction {
  _id: string;
  partId: string;
  branchId: string;
  workOrderId?: string;
  type: 'RESERVE' | 'RELEASE' | 'INSTALL' | 'RETURN' | 'RESTOCK' | 'ADJUSTMENT';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  performedBy: string;
  performedByRole: string;
  createdAt: string;
}

export interface WorkshopRequirement {
  _id: string;
  workOrderNumber: string;
  workOrderType: string;
  status: string;
  vehicleLabel: string;
  parts: Array<{
    _id: string;
    partName: string;
    partNumber?: string;
    quantity: number;
    status: 'REQUESTED' | 'RESERVED' | 'INSTALLED';
    inventoryPartId?: string;
  }>;
}

// ── CRUD ─────────────────────────────────────────────────────────────

export const getParts = async (filters: any = {}): Promise<InventoryPart[]> => {
  const response = await api.get('/api/inventory', { params: filters });
  return response.data.data || response.data;
};

export const getPartById = async (id: string): Promise<InventoryPart> => {
  const response = await api.get(`/api/inventory/${id}`);
  return response.data.data || response.data;
};

export const createPart = async (payload: Partial<InventoryPart>): Promise<InventoryPart> => {
  const response = await api.post('/api/inventory', payload);
  return response.data.data || response.data;
};

export const bulkCreateParts = async (payload: { parts: Partial<InventoryPart>[] }): Promise<{ successCount: number, parts: any[], errorCount?: number, message?: string }> => {
  const response = await api.post('/api/inventory/bulk', payload);
  return response.data.data || response.data;
};

export const updatePart = async (id: string, payload: Partial<InventoryPart>): Promise<InventoryPart> => {
  const response = await api.put(`/api/inventory/${id}`, payload);
  return response.data.data || response.data;
};

export const deletePart = async (id: string): Promise<void> => {
  await api.delete(`/api/inventory/${id}`);
};

// ── Stock Actions ────────────────────────────────────────────────────

export const restockPart = async (id: string, quantity: number): Promise<InventoryPart> => {
  const response = await api.put(`/api/inventory/${id}/restock`, { quantity });
  return response.data.data || response.data;
};

export const reserveStock = async (id: string, quantity: number): Promise<InventoryPart> => {
  const response = await api.put(`/api/inventory/${id}/reserve`, { quantity });
  return response.data.data || response.data;
};

export const releaseStock = async (id: string, quantity: number): Promise<InventoryPart> => {
  const response = await api.put(`/api/inventory/${id}/release`, { quantity });
  return response.data.data || response.data;
};

export const installPart = async (id: string, quantity: number): Promise<InventoryPart> => {
  const response = await api.put(`/api/inventory/${id}/install`, { quantity });
  return response.data.data || response.data;
};

// ── Blocking Actions ──────────────────────────────────────────────────

export const blockMaterialCode = async (id: string, isBlocked: boolean, blockedReason?: string): Promise<InventoryPart> => {
  const response = await api.patch(`/api/inventory/${id}/block`, { isBlocked, blockedReason });
  return response.data.data || response.data;
};

export const blockPartQuantity = async (id: string, quantityBlocked: number, blockedReason?: string): Promise<InventoryPart> => {
  const response = await api.patch(`/api/inventory/${id}/block-quantity`, { quantityBlocked, blockedReason });
  return response.data.data || response.data;
};

// ── Multi-Stock Overview & Reports ───────────────────────────────────

export const getMultiStockOverview = async (codes: string | string[], branchId?: string): Promise<{ totalFound: number, requestedCodes: string[], data: any[] }> => {
  const response = await api.post('/api/inventory/multi-stock-overview', { codes, branchId });
  return response.data;
};

export const getConsumptionReport = async (filters: { period?: string, startDate?: string, endDate?: string, itemCodes?: string, branchId?: string }): Promise<{ summary: any, data: any[] }> => {
  const response = await api.get('/api/inventory/reports/consumption', { params: filters });
  return response.data;
};

// ── Transactions & Requirements ──────────────────────────────────────

export const getPartTransactions = async (id: string): Promise<PartTransaction[]> => {
  const response = await api.get(`/api/inventory/${id}/transactions`);
  return response.data.data || response.data;
};

export const getWorkshopRequirements = async (branchId: string): Promise<WorkshopRequirement[]> => {
  const response = await api.get(`/api/inventory/workshop-requirements/${branchId}`);
  return response.data.data || response.data;
};

export const getLowStock = async (branchId: string): Promise<InventoryPart[]> => {
  const response = await api.get(`/api/inventory/low-stock/${branchId}`);
  return response.data.data || response.data;
};
