import api from './api';

// ── Enums / Types ────────────────────────────────────────────────────

export type WorkOrderStatus =
    | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
    | 'VEHICLE_CHECKED_IN' | 'PARTS_REQUESTED' | 'PARTS_RECEIVED'
    | 'IN_PROGRESS' | 'PAUSED' | 'ADDITIONAL_WORK_FOUND'
    | 'QUALITY_CHECK' | 'FAILED_QC' | 'READY_FOR_RELEASE'
    | 'VEHICLE_RELEASED' | 'INVOICED' | 'CLOSED' | 'CANCELLED';

export type WorkOrderType =
    | 'PREVENTIVE' | 'CORRECTIVE' | 'PRE_ENTRY' | 'ACCIDENT'
    | 'RETURN_INSPECTION' | 'RECALL' | 'SAFETY_PREP' | 'WEAR_ITEM';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
export type PartStatus = 'REQUESTED' | 'RESERVED' | 'RECEIVED' | 'INSTALLED' | 'RETURNED';
export type LabourAction = 'CLOCK_IN' | 'CLOCK_OUT' | 'PAUSE' | 'RESUME';
export type QCResult = 'PENDING' | 'PASS' | 'FAIL' | 'NA';
export type TaskCategory = 'Mechanical' | 'Electrical' | 'Body' | 'Tyres' | 'Fluids' | 'Other';
export type PartSource = 'IN_STOCK' | 'ORDERED' | 'EXTERNAL_VENDOR';
export type PhotoStage = 'CHECK_IN' | 'IN_PROGRESS' | 'QC' | 'RELEASE';

// ── Interfaces ───────────────────────────────────────────────────────

export interface WorkOrderTask {
    _id: string;
    description: string;
    category?: TaskCategory;
    status: TaskStatus;
    assignedTo?: string | Record<string, unknown>;
    estimatedHours?: number;
    actualHours?: number;
    completedAt?: string;
    notes?: string;
}

export interface WorkOrderPart {
    _id: string;
    partName: string;
    partNumber?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    source: PartSource;
    status: PartStatus;
    receivedDate?: string;
    installedBy?: string;
}

export interface LabourEntry {
    _id: string;
    technicianId: string | Record<string, unknown>;
    action: LabourAction;
    timestamp: string;
    taskReference?: string;
    notes?: string;
}

export interface QCItem {
    _id: string;
    checkItem: string;
    category?: string;
    result: QCResult;
    notes?: string;
    checkedBy?: string;
    checkedAt?: string;
}

export interface WorkOrderPhoto {
    _id: string;
    url: string;
    caption?: string;
    stage: PhotoStage;
    uploadedBy?: string;
    uploadedAt?: string;
}

export interface StatusHistoryEntry {
    status: WorkOrderStatus;
    changedBy?: string;
    changedByRole?: string;
    timestamp: string;
    notes?: string;
}

export interface WorkOrder {
    _id: string;
    workOrderNumber: string;
    workOrderType: WorkOrderType;
    status: WorkOrderStatus;
    vehicleId: string | Record<string, unknown>;
    branchId: string | Record<string, unknown>;
    priority: Priority;
    slaDeadline?: string;
    faultDescription: string;
    assignedTechnician?: string | Record<string, unknown>;
    odometerAtEntry?: number;
    odometerAtRelease?: number;
    estimatedLabourHours: number;
    actualLabourHours: number;
    estimatedPartsCost: number;
    actualPartsCost: number;
    estimatedTotalCost: number;
    actualTotalCost: number;
    tasks: WorkOrderTask[];
    parts: WorkOrderPart[];
    labourLog: LabourEntry[];
    qcChecklist: QCItem[];
    photos: WorkOrderPhoto[];
    notes?: string;
    additionalWorkScope?: string;
    pauseReason?: string;
    rejectionReason?: string;
    cancellationReason?: string;
    releaseNotes?: string;
    statusHistory: StatusHistoryEntry[];
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

// ── Create Work Order ────────────────────────────────────────────────

export interface CreateWorkOrderPayload {
    workOrderType: WorkOrderType;
    vehicleId: string;
    branchId: string;
    priority?: Priority;
    faultDescription: string;
    assignedTechnician?: string;
    estimatedLabourHours?: number;
    estimatedPartsCost?: number;
    estimatedTotalCost?: number;
    notes?: string;
}

export const createWorkOrder = async (payload: CreateWorkOrderPayload): Promise<WorkOrder> => {
    const response = await api.post('/api/work-orders', payload);
    return response.data.data || response.data;
};

// ── Get Work Orders ──────────────────────────────────────────────────

export interface WorkOrderFilters {
    status?: WorkOrderStatus;
    branchId?: string;
    vehicleId?: string;
    priority?: Priority;
    workOrderType?: WorkOrderType;
}

export const getWorkOrders = async (filters: WorkOrderFilters = {}): Promise<WorkOrder[]> => {
    const response = await api.get('/api/work-orders', { params: filters });
    return response.data.data || response.data;
};

export const getWorkOrderById = async (id: string): Promise<WorkOrder> => {
    const response = await api.get(`/api/work-orders/${id}`);
    return response.data.data || response.data;
};

// ── Progress Status ──────────────────────────────────────────────────

export const progressWorkOrderStatus = async (
    id: string,
    targetStatus: WorkOrderStatus,
    notes?: string,
    updateData?: Record<string, unknown>
): Promise<WorkOrder> => {
    const response = await api.put(`/api/work-orders/${id}/progress`, {
        targetStatus,
        notes,
        updateData,
    });
    return response.data.data || response.data;
};

// ── Tasks ────────────────────────────────────────────────────────────

export interface AddTaskPayload {
    description: string;
    category?: TaskCategory;
    assignedTo?: string;
    estimatedHours?: number;
    notes?: string;
}

export const addTask = async (workOrderId: string, payload: AddTaskPayload): Promise<WorkOrder> => {
    const response = await api.post(`/api/work-orders/${workOrderId}/tasks`, payload);
    return response.data.data || response.data;
};

export interface UpdateTaskPayload {
    status?: TaskStatus;
    actualHours?: number;
    notes?: string;
    assignedTo?: string;
}

export const updateTask = async (
    workOrderId: string,
    taskId: string,
    payload: UpdateTaskPayload
): Promise<WorkOrder> => {
    const response = await api.put(`/api/work-orders/${workOrderId}/tasks/${taskId}`, payload);
    return response.data.data || response.data;
};

export const removeTask = async (workOrderId: string, taskId: string): Promise<WorkOrder> => {
    const response = await api.delete(`/api/work-orders/${workOrderId}/tasks/${taskId}`);
    return response.data.data || response.data;
};

// ── Parts ────────────────────────────────────────────────────────────

export interface AddPartPayload {
    partName: string;
    partNumber?: string;
    quantity: number;
    unitCost?: number;
    source?: PartSource;
}

export const addPart = async (workOrderId: string, payload: AddPartPayload): Promise<WorkOrder> => {
    const response = await api.post(`/api/work-orders/${workOrderId}/parts`, payload);
    return response.data.data || response.data;
};

export interface UpdatePartPayload {
    status?: PartStatus;
    quantity?: number;
    unitCost?: number;
    receivedDate?: string;
    installedBy?: string;
    source?: PartSource;
}

export const updatePart = async (
    workOrderId: string,
    partId: string,
    payload: UpdatePartPayload
): Promise<WorkOrder> => {
    const response = await api.put(`/api/work-orders/${workOrderId}/parts/${partId}`, payload);
    return response.data.data || response.data;
};

export const removePart = async (workOrderId: string, partId: string): Promise<WorkOrder> => {
    const response = await api.delete(`/api/work-orders/${workOrderId}/parts/${partId}`);
    return response.data.data || response.data;
};

// ── Labour ───────────────────────────────────────────────────────────

export interface LogLabourPayload {
    action: LabourAction;
    technicianId?: string;
    taskReference?: string;
    notes?: string;
}

export const logLabour = async (workOrderId: string, payload: LogLabourPayload): Promise<WorkOrder> => {
    const response = await api.post(`/api/work-orders/${workOrderId}/labour`, payload);
    return response.data.data || response.data;
};

// ── QC ───────────────────────────────────────────────────────────────

export const generateQC = async (workOrderId: string): Promise<WorkOrder> => {
    const response = await api.post(`/api/work-orders/${workOrderId}/qc/generate`);
    return response.data.data || response.data;
};

export interface QCSubmitResult {
    checkItem: string;
    result: 'PASS' | 'FAIL' | 'NA';
    notes?: string;
}

export const submitQC = async (workOrderId: string, results: QCSubmitResult[]): Promise<WorkOrder> => {
    const response = await api.put(`/api/work-orders/${workOrderId}/qc/submit`, { results });
    return response.data.data || response.data;
};

// ── Photos ───────────────────────────────────────────────────────────

export interface AddPhotoPayload {
    url: string;
    caption?: string;
    stage?: PhotoStage;
}

export const addPhoto = async (workOrderId: string, payload: AddPhotoPayload): Promise<WorkOrder> => {
    const response = await api.post(`/api/work-orders/${workOrderId}/photos`, payload);
    return response.data.data || response.data;
};

export const addPhotoFile = async (workOrderId: string, file: File, stage: PhotoStage = 'IN_PROGRESS'): Promise<WorkOrder> => {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('stage', stage);
    
    const response = await api.post(`/api/work-orders/${workOrderId}/photos`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data.data || response.data;
};

// ── Vehicle Release ──────────────────────────────────────────────────

export const releaseVehicle = async (
    workOrderId: string,
    data?: { odometerAtRelease?: number; releaseNotes?: string }
): Promise<WorkOrder> => {
    const response = await api.put(`/api/work-orders/${workOrderId}/release`, data || {});
    return response.data.data || response.data;
};
