import api from './api';

// ── Types ────────────────────────────────────────────────────────────

export interface LinkedPart {
    inventoryPartId: string | {
        _id: string;
        partName: string;
        partNumber: string;
        quantityOnHand: number;
        quantityReserved: number;
        unitCost: number;
        isActive: boolean;
    };
    partName: string;
    partNumber: string;
    defaultQuantity: number;
}

export interface TaskTemplate {
    _id: string;
    name: string;
    description?: string;
    category: string;
    estimatedHours: number;
    workOrderTypes: string[];
    linkedParts: LinkedPart[];
    isActive: boolean;
    branchId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaskTemplatePayload {
    name: string;
    description?: string;
    category: string;
    estimatedHours?: number;
    workOrderTypes: string[];
    linkedParts?: { inventoryPartId: string; partName: string; partNumber: string; defaultQuantity: number }[];
    branchId?: string;
}

// ── API Functions ────────────────────────────────────────────────────

export const getTaskTemplates = async (filters: {
    branchId?: string;
    workOrderType?: string;
    search?: string;
} = {}): Promise<TaskTemplate[]> => {
    const response = await api.get('/api/task-templates', { params: filters });
    return response.data.data || response.data || [];
};

export const getTaskTemplateById = async (id: string): Promise<TaskTemplate> => {
    const response = await api.get(`/api/task-templates/${id}`);
    return response.data.data || response.data;
};

export const getTaskTemplatesByType = async (type: string, branchId?: string): Promise<TaskTemplate[]> => {
    const response = await api.get(`/api/task-templates/by-type/${type}`, { params: branchId ? { branchId } : {} });
    return response.data.data || response.data || [];
};

export const createTaskTemplate = async (payload: CreateTaskTemplatePayload): Promise<TaskTemplate> => {
    const response = await api.post('/api/task-templates', payload);
    return response.data.data || response.data;
};

export const updateTaskTemplate = async (id: string, payload: Partial<CreateTaskTemplatePayload>): Promise<TaskTemplate> => {
    const response = await api.put(`/api/task-templates/${id}`, payload);
    return response.data.data || response.data;
};

export const deleteTaskTemplate = async (id: string): Promise<TaskTemplate> => {
    const response = await api.delete(`/api/task-templates/${id}`);
    return response.data.data || response.data;
};

// ── Toggle Task Doable (on Work Order) ───────────────────────────────

export const toggleTaskDoable = async (workOrderId: string, taskId: string): Promise<any> => {
    const response = await api.put(`/api/work-orders/${workOrderId}/tasks/${taskId}/toggle-doable`);
    return response.data.data || response.data;
};
