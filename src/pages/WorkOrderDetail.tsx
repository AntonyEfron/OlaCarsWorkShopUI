import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, Loader2, Info, ListChecks, Package, Clock, Shield, Camera,
    Play, Pause, Square, PlusCircle, Trash2, CheckCircle2, ChevronRight, Upload, AlertTriangle,
} from 'lucide-react';
import {
    getWorkOrderById, progressWorkOrderStatus, addTask, updateTask, removeTask,
    addPart, updatePart, removePart, logLabour, generateQC, submitQC, addPhoto, addPhotoFile,
    releaseVehicle,
    type WorkOrder, type WorkOrderStatus, type TaskStatus, type PartStatus,
    type QCResult, type AddTaskPayload, type AddPartPayload, type PartSource,
} from '../services/workOrderService';
import { getUserId, getUser } from '../utils/auth';
import { getParts, type InventoryPart } from '../services/inventoryService';

type Tab = 'overview' | 'tasks' | 'parts' | 'labour' | 'qc' | 'photos';

const ALLOWED_TRANSITIONS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
    DRAFT: ['START', 'CANCELLED'],
    START: ['VEHICLE_CHECKED_IN', 'CANCELLED'],
    VEHICLE_CHECKED_IN: ['PARTS_REQUESTED', 'IN_PROGRESS'],
    PARTS_REQUESTED: ['PARTS_RECEIVED'],
    PARTS_RECEIVED: ['IN_PROGRESS'],
    IN_PROGRESS: ['PAUSED', 'ADDITIONAL_WORK_FOUND', 'QUALITY_CHECK'],
    PAUSED: ['IN_PROGRESS'],
    ADDITIONAL_WORK_FOUND: ['IN_PROGRESS', 'START'],
    QUALITY_CHECK: ['READY_FOR_RELEASE', 'FAILED_QC'],
    FAILED_QC: ['IN_PROGRESS'],
    READY_FOR_RELEASE: ['VEHICLE_RELEASED'],
};

const WorkOrderDetail = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [wo, setWo] = useState<WorkOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [actionLoading, setActionLoading] = useState(false);

    const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
        { key: 'overview', label: t('workOrders.detail.overview'), icon: Info },
        { key: 'tasks', label: t('workOrders.detail.tasks'), icon: ListChecks },
        { key: 'parts', label: t('workOrders.detail.parts'), icon: Package },
        { key: 'labour', label: t('workOrders.detail.labour'), icon: Clock },
        { key: 'qc', label: t('workOrders.detail.qc'), icon: Shield },
        { key: 'photos', label: 'Photos', icon: Camera },
    ];

    /* ── Task form state ── */
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskForm, setTaskForm] = useState<AddTaskPayload>({ description: '', category: 'Mechanical', estimatedHours: 1 });

    /* ── Part form state ── */
    const [showPartForm, setShowPartForm] = useState(false);
    const [partForm, setPartForm] = useState<AddPartPayload>({ partName: '', quantity: 1, unitCost: 0, source: 'IN_STOCK' });
    const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
    const [selectedInventoryPart, setSelectedInventoryPart] = useState<InventoryPart | null>(null);
    const [partsLoading, setPartsLoading] = useState(false);
    const user = getUser();
    const branchId = (user?.branchId as string) || '';

    /* ── Photo form ── */
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    /* ── Release form ── */
    const [releaseOdometer, setReleaseOdometer] = useState('');
    const [releaseNotes, setReleaseNotes] = useState('');

    const load = useCallback(async () => {
        
        if (!id) return;
        try {
            const data = await getWorkOrderById(id);
            setWo(data);
        } catch { /* interceptor */ } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    // Load inventory parts for the dropdown
    useEffect(() => {
        const woBranchId = typeof wo?.branchId === 'object' ? (wo.branchId as any)?._id : wo?.branchId;
        const fetchBranchId = woBranchId || branchId;
        if (fetchBranchId) {
            setPartsLoading(true);
            getParts({ branchId: fetchBranchId }).then(parts => {
                setInventoryParts(parts.filter(p => p.isActive));
            }).catch(() => {}).finally(() => setPartsLoading(false));
        }
    }, [wo?.branchId, branchId]);

    const handleBackendError = (err: any) => {
        const msg = (err.response?.data?.message || err.message || '').toLowerCase();
        if (msg.includes('part')) setActiveTab('parts');
        else if (msg.includes('photo')) setActiveTab('photos');
        else if (msg.includes('task')) setActiveTab('tasks');
        else if (msg.includes('odometer') || msg.includes('entry') || msg.includes('additional work')) setActiveTab('overview');
        return err;
    };

    const doAction = async (fn: () => Promise<unknown>) => {
        setActionLoading(true);
        try {
            await fn();
            await load();
        } catch (err: any) {
            handleBackendError(err);
            throw err;
        } finally {
            setActionLoading(false);
        }
    };

    /* ── Helpers ── */
    const getStatusBadge = (status: string) => {
        if (['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'].includes(status)) return 'badge-lime';
        if (['DRAFT'].includes(status)) return 'badge-gray';
        if (['START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'].includes(status)) return 'badge-blue';
        if (['QUALITY_CHECK', 'FAILED_QC'].includes(status)) return 'badge-orange';
        if (['READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'CLOSED'].includes(status)) return 'badge-green';
        if (['REJECTED', 'CANCELLED'].includes(status)) return 'badge-red';
        return 'badge-gray';
    };
    const fmtStatus = (s: string) => s.replace(/_/g, ' ');
    const fmtDate = (d?: string) => d ? new Date(d).toLocaleString() : '—';

    const vehicleLabel = () => {
        if (!wo) return '';
        const v = wo.vehicleId;
        if (typeof v === 'object' && v) {
            const bd = (v as Record<string, unknown>).basicDetails as Record<string, unknown> | undefined;
            if (bd) return `${bd.make || ''} ${bd.model || ''} ${bd.year || ''}`.trim();
        }
        return typeof v === 'string' ? v : 'N/A';
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-lime)' }} /></div>
    );
    if (!wo) return (
        <div className="text-center py-20"><p style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p></div>
    );

    const nextStatuses = ALLOWED_TRANSITIONS[wo.status] || [];

    /* ═══════════════════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════════════════ */
    return (
        <div className="space-y-5 animate-fadeInUp">
            {/* ── Header ── */}
            <div className="flex items-start gap-3 flex-wrap">
                <button className="btn-icon flex-shrink-0" onClick={() => navigate('/work-orders')} id="back-to-list"><ArrowLeft size={18} /></button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>{wo.workOrderNumber}</h1>
                        <span className={`badge ${getStatusBadge(wo.status)}`}>{fmtStatus(wo.status)}</span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{vehicleLabel()} • {wo.workOrderType.replace(/_/g, ' ')}</p>
                </div>
            </div>

            {/* ── Status Stepper (Workflow) ── */}
            <StatusStepper currentStatus={wo.status} t_func={t} />

            {/* ── Status Actions ── */}
            {nextStatuses.length > 0 && (
                <div className="glass-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{t('workOrders.detail.actions')}</p>
                    <div className="flex flex-wrap gap-2">
                        {nextStatuses.map((ns) => (
                            <button key={ns} disabled={actionLoading}
                                className="btn-secondary text-xs !py-2 !px-4"
                                onClick={() => doAction(async () => {
                                    let updateData: any = ns === 'IN_PROGRESS' ? { assignedTechnician: getUserId() || undefined } : undefined;
                                    
                                    if (ns === 'VEHICLE_CHECKED_IN') {
                                        const vehicleOdo = (wo.vehicleId as any)?.basicDetails?.odometer;
                                        if (!wo.odometerAtEntry && !vehicleOdo) {
                                            const odo = window.prompt('Please enter the entry odometer reading:');
                                            if (odo === null) return; // cancel
                                            if (!odo) throw new Error('Odometer reading at entry is required.');
                                            updateData = { ...updateData, odometerAtEntry: Number(odo) };
                                        }
                                    }
                                    
                                    if (ns === 'ADDITIONAL_WORK_FOUND') {
                                        const scope = window.prompt(t('workOrders.detail.additionalWorkPrompt') || 'Please describe the additional work found:');
                                        if (scope === null) return; // cancel
                                        if (!scope) throw new Error('Description of additional work scope is required.');
                                        updateData = { ...updateData, additionalWorkScope: scope };
                                    }
                                    
                                    return progressWorkOrderStatus(id!, ns, undefined, updateData);
                                })}
                            >
                                <ChevronRight size={14} /> {fmtStatus(ns)}
                            </button>
                        ))}
                        {wo.status === 'READY_FOR_RELEASE' && (
                            <button disabled={actionLoading} className="btn-primary text-xs !py-2 !px-4"
                                onClick={() => doAction(() => releaseVehicle(id!, { odometerAtRelease: releaseOdometer ? Number(releaseOdometer) : undefined, releaseNotes: releaseNotes || undefined }))}
                            >
                                <CheckCircle2 size={14} /> {t('workOrders.detail.release')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="tab-nav">
                {TABS.map((t_tab) => (
                    <button key={t_tab.key} className={`tab-btn ${activeTab === t_tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(t_tab.key)}>
                        <t_tab.icon size={16} className="inline mr-1.5" />{t_tab.label}
                        {t_tab.key === 'tasks' && wo.tasks.length > 0 && <span className="ml-1 text-[10px] opacity-70">({wo.tasks.length})</span>}
                        {t_tab.key === 'parts' && wo.parts.length > 0 && <span className="ml-1 text-[10px] opacity-70">({wo.parts.length})</span>}
                        {t_tab.key === 'photos' && wo.photos.length > 0 && <span className="ml-1 text-[10px] opacity-70">({wo.photos.length})</span>}
                    </button>
                ))}
            </div>

            {/* ══════════════════ OVERVIEW TAB ══════════════════ */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.overview')}</h3>
                        <InfoRow label={t('dashboard.table.type')} value={t(`workOrders.types.${wo.workOrderType.toLowerCase()}`, { defaultValue: wo.workOrderType.replace(/_/g, ' ') })} />
                        <InfoRow label={t('dashboard.table.priority')} value={t(`workOrders.priorities.${wo.priority.toLowerCase()}`, { defaultValue: wo.priority })} />
                        <InfoRow label={t('workOrders.create.vehicle')} value={vehicleLabel()} />
                        <InfoRow label={t('common.created')} value={fmtDate(wo.createdAt)} />
                        <InfoRow label={t('common.updated')} value={fmtDate(wo.updatedAt)} />
                    </div>
                    <div className="glass-card p-5 space-y-4">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.faultCost')}</h3>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('workOrders.create.fault')}</p>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-main)' }}>{wo.faultDescription}</p>
                        </div>
                        <InfoRow label={t('workOrders.create.labourHrs')} value={String(wo.estimatedLabourHours)} />
                        <InfoRow label="Actual Labour Hours" value={String(wo.actualLabourHours)} />
                        <InfoRow label={t('workOrders.create.partsCost')} value={`$${wo.estimatedPartsCost.toFixed(2)}`} />
                        <InfoRow label="Actual Parts Cost" value={`$${wo.actualPartsCost.toFixed(2)}`} />
                        {wo.notes && <InfoRow label={t('workOrders.create.notes')} value={wo.notes} />}
                    </div>
                </div>
            )}

            {/* ══════════════════ TASKS TAB ══════════════════ */}
            {activeTab === 'tasks' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.tasks')} ({wo.tasks.length})</h3>
                        <button className="btn-primary text-xs !py-2" onClick={() => setShowTaskForm(!showTaskForm)}>
                            <PlusCircle size={14} /> {t('common.addItem')}
                        </button>
                    </div>
                    {showTaskForm && (
                        <div className="glass-card p-4 space-y-3">
                            <input placeholder={t('workOrders.create.faultPlaceholder')} value={taskForm.description}
                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                className="input-field" />
                            <div className="grid grid-cols-2 gap-3">
                                <select value={taskForm.category || ''} onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value as AddTaskPayload['category'] })} className="input-field">
                                    {['Mechanical', 'Electrical', 'Body', 'Tyres', 'Fluids', 'Other'].map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input type="number" placeholder="Est. hours" value={taskForm.estimatedHours || ''} onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: Number(e.target.value) })} className="input-field" min="0" step="0.5" />
                            </div>
                            <div className="flex gap-2">
                                <button className="btn-secondary text-xs flex-1" onClick={() => setShowTaskForm(false)}>{t('common.cancel')}</button>
                                <button className="btn-primary text-xs flex-1" disabled={!taskForm.description || actionLoading}
                                    onClick={() => doAction(async () => { await addTask(id!, taskForm); setShowTaskForm(false); setTaskForm({ description: '', category: 'Mechanical', estimatedHours: 1 }); })}>
                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : t('common.add')}
                                </button>
                            </div>
                        </div>
                    )}
                    {wo.tasks.length === 0 ? (
                        <div className="glass-card p-8 text-center">
                            <ListChecks size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {wo.tasks.map((task) => (
                                <div key={task._id} className="glass-card p-4 flex items-start gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{task.description}</p>
                                            <span className={`badge text-[10px] ${task.status === 'COMPLETED' ? 'badge-green' : task.status === 'IN_PROGRESS' ? 'badge-lime' : 'badge-gray'}`}>
                                                {task.status}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                                            {task.category} • Est: {task.estimatedHours || 0}h{task.actualHours ? ` • Actual: ${task.actualHours}h` : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        {task.status === 'PENDING' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Start" disabled={actionLoading}
                                                onClick={() => doAction(() => updateTask(id!, task._id, { status: 'IN_PROGRESS' as TaskStatus }))}>
                                                <Play size={14} />
                                            </button>
                                        )}
                                        {task.status === 'IN_PROGRESS' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Complete" disabled={actionLoading}
                                                onClick={() => doAction(() => updateTask(id!, task._id, { status: 'COMPLETED' as TaskStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {task.status === 'PENDING' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px] !text-red-500" title="Remove" disabled={actionLoading}
                                                onClick={() => doAction(() => removeTask(id!, task._id))}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════ PARTS TAB ══════════════════ */}
            {activeTab === 'parts' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.parts')} ({wo.parts.length})</h3>
                        <button className="btn-primary text-xs !py-2" onClick={() => setShowPartForm(!showPartForm)}>
                            <PlusCircle size={14} /> {t('common.addItem')}
                        </button>
                    </div>
                    {showPartForm && (
                        <div className="glass-card p-4 space-y-3">
                            {/* Part Dropdown */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Select Part from Inventory *</label>
                                <select
                                    className="input-field"
                                    value={selectedInventoryPart?._id || ''}
                                    onChange={(e) => {
                                        const part = inventoryParts.find(p => p._id === e.target.value);
                                        setSelectedInventoryPart(part || null);
                                        if (part) {
                                            setPartForm({
                                                ...partForm,
                                                partName: part.partName,
                                                partNumber: part.partNumber,
                                                unitCost: part.unitCost,
                                                inventoryPartId: part._id,
                                                source: 'IN_STOCK',
                                            });
                                        }
                                    }}
                                >
                                    <option value="">{partsLoading ? 'Loading parts...' : '— Choose a part —'}</option>
                                    {inventoryParts.map(p => {
                                        const available = p.quantityOnHand - p.quantityReserved;
                                        return (
                                            <option key={p._id} value={p._id}>
                                                {p.partName} ({p.partNumber}) — {available > 0 ? `${available} available` : 'OUT OF STOCK'}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Stock Indicator */}
                            {selectedInventoryPart && (() => {
                                const available = selectedInventoryPart.quantityOnHand - selectedInventoryPart.quantityReserved;
                                const isOutOfStock = available <= 0;
                                const isInsufficient = !isOutOfStock && available < partForm.quantity;
                                return (
                                    <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
                                        isOutOfStock ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        : isInsufficient ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                        : 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    }`}>
                                        {isOutOfStock ? <AlertTriangle size={14} /> : isInsufficient ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                                        {isOutOfStock
                                            ? 'Out of stock — part will be added as a REQUEST for manager approval.'
                                            : isInsufficient
                                            ? `Only ${available} available — need ${partForm.quantity}. Will be added as a REQUEST.`
                                            : `${available} in stock — will be reserved.`
                                        }
                                    </div>
                                );
                            })()}

                            {/* Quantity */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Quantity</label>
                                <input type="number" placeholder="Qty" value={partForm.quantity} onChange={(e) => setPartForm({ ...partForm, quantity: Number(e.target.value) })} className="input-field max-w-[200px]" min="1" />
                            </div>

                            <div className="flex gap-2">
                                <button className="btn-secondary text-xs flex-1" onClick={() => { setShowPartForm(false); setSelectedInventoryPart(null); }}>{t('common.cancel')}</button>
                                <button className="btn-primary text-xs flex-1" disabled={!selectedInventoryPart || actionLoading}
                                    onClick={() => doAction(async () => {
                                        await addPart(id!, partForm);
                                        setShowPartForm(false);
                                        setSelectedInventoryPart(null);
                                        setPartForm({ partName: '', quantity: 1, unitCost: 0, source: 'IN_STOCK' });
                                    })}>
                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : t('common.add')}
                                </button>
                            </div>
                        </div>
                    )}
                    {wo.parts.length === 0 ? (
                        <div className="glass-card p-8 text-center">
                            <Package size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {wo.parts.map((part) => (
                                <div key={part._id} className="glass-card p-4 flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                        part.status === 'INSTALLED' ? 'bg-green-500/10 text-green-500'
                                        : part.status === 'REQUESTED' ? 'bg-orange-500/10 text-orange-500'
                                        : 'bg-blue-500/10 text-blue-500'
                                    }`}>
                                        {part.status === 'INSTALLED' ? <CheckCircle2 size={20} />
                                        : part.status === 'REQUESTED' ? <AlertTriangle size={20} />
                                        : <Package size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>{part.partName}</p>
                                            <span className={`badge text-[10px] ${
                                                part.status === 'INSTALLED' ? 'badge-green'
                                                : part.status === 'REQUESTED' ? 'badge-orange'
                                                : part.status === 'RESERVED' ? 'badge-blue'
                                                : part.status === 'RECEIVED' ? 'badge-blue'
                                                : 'badge-gray'
                                            }`}>
                                                {part.status === 'REQUESTED' ? '⏳ AWAITING APPROVAL' : part.status}
                                            </span>
                                        </div>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                                            Qty: {part.quantity} • ${part.unitCost.toFixed(2)} each = ${part.totalCost.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        {part.status === 'REQUESTED' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Approve & Install" disabled={actionLoading}
                                                onClick={() => doAction(() => updatePart(id!, part._id, { status: 'INSTALLED' as PartStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {part.status === 'RESERVED' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Mark Installed" disabled={actionLoading}
                                                onClick={() => doAction(() => updatePart(id!, part._id, { status: 'INSTALLED' as PartStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {part.status === 'RECEIVED' && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px]" title="Mark Installed" disabled={actionLoading}
                                                onClick={() => doAction(() => updatePart(id!, part._id, { status: 'INSTALLED' as PartStatus }))}>
                                                <CheckCircle2 size={14} />
                                            </button>
                                        )}
                                        {(part.status === 'REQUESTED' || part.status === 'RECEIVED' || part.status === 'RESERVED') && (
                                            <button className="btn-icon !min-w-[36px] !min-h-[36px] !text-red-500" title="Remove" disabled={actionLoading}
                                                onClick={() => doAction(() => removePart(id!, part._id))}>
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════ LABOUR TAB ══════════════════ */}
            {activeTab === 'labour' && (
                <div className="space-y-4">
                    <div className="glass-card p-6">
                        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.labour')}</h3>
                        <div className="flex flex-col gap-4">
                            {/* Stats Summary */}
                            <div className="grid grid-cols-2 gap-4 mb-2">
                                <div className="glass-card p-4 text-center">
                                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Estimated</p>
                                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{wo.estimatedLabourHours || 0}h</p>
                                </div>
                                <div className="glass-card p-4 text-center border-l-2 border-[var(--brand-lime)]">
                                    <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Actual</p>
                                    <p className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>{wo.actualLabourHours || 0}h</p>
                                </div>
                            </div>

                            {/* Automated/Manual Controls */}
                            <div className="grid grid-cols-1 gap-3">
                                {wo.status === 'IN_PROGRESS' && (
                                    <button className="flex items-center justify-center gap-3 p-6 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95 shadow-lg w-full"
                                        style={{ background: '#E67E2222', color: '#E67E22', border: '2px solid #E67E2244' }}
                                        disabled={actionLoading}
                                        onClick={() => doAction(async () => {
                                            const reason = window.prompt('Please enter the pause reason:');
                                            if (reason === null) return;
                                            if (!reason) throw new Error('Pause reason is required.');
                                            await logLabour(id!, { action: 'PAUSE', technicianId: getUserId() || undefined, notes: reason });
                                            // Status transition to PAUSED is handled by the Status Bar actions, 
                                            // but if they just want to pause the timer without changing status? 
                                            // Actually, the request says "progress status bar makes the timer run".
                                            // So PAUSE action should probably also trigger status change to PAUSED.
                                            await progressWorkOrderStatus(id!, 'PAUSED', reason);
                                        })}>
                                        <Pause size={24} />
                                        <div className="text-left">
                                            <p className="leading-tight">Pause Work</p>
                                            <p className="text-[10px] opacity-60 font-medium uppercase tracking-wider">Requires reason prompt</p>
                                        </div>
                                    </button>
                                )}

                                {wo.status === 'PAUSED' && (
                                    <button className="flex items-center justify-center gap-3 p-6 rounded-2xl font-bold text-sm transition-all duration-200 cursor-pointer active:scale-95 shadow-lg w-full"
                                        style={{ background: '#3498DB22', color: '#3498DB', border: '2px solid #3498DB44' }}
                                        disabled={actionLoading}
                                        onClick={() => doAction(async () => {
                                            await logLabour(id!, { action: 'RESUME', technicianId: getUserId() || undefined });
                                            await progressWorkOrderStatus(id!, 'IN_PROGRESS');
                                        })}>
                                        <Play size={24} />
                                        <div className="text-left">
                                            <p className="leading-tight">Resume Work</p>
                                            <p className="text-[10px] opacity-60 font-medium uppercase tracking-wider">Continues automated tracking</p>
                                        </div>
                                    </button>
                                )}

                                {(wo.status !== 'IN_PROGRESS' && wo.status !== 'PAUSED') && (
                                    <div className="glass-card p-6 text-center border-dashed border-2 opacity-60">
                                        <Clock size={32} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-dim)' }} />
                                        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>Labour Tracking</p>
                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                            {wo.status === 'QUALITY_CHECK' || wo.status === 'READY_FOR_RELEASE' || wo.status === 'VEHICLE_RELEASED' 
                                                ? 'Work completed. Labour logs finalized.'
                                                : 'Automatic timer starts when status is set to IN PROGRESS.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════ QC TAB ══════════════════ */}
            {activeTab === 'qc' && (
                <div className="space-y-4">
                    <div className="glass-card p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{t('workOrders.detail.qc')} ({wo.qcChecklist.length})</h3>
                            {wo.qcChecklist.length === 0 && (
                                <button className="btn-primary text-xs !py-2" disabled={actionLoading}
                                    onClick={() => doAction(() => generateQC(id!))}>
                                    <Shield size={14} /> Generate Checklist
                                </button>
                            )}
                        </div>
                        {wo.qcChecklist.map((qc) => (
                            <div key={qc._id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border-main)' }}>
                                <div className="flex-1">
                                    <p className="text-sm" style={{ color: 'var(--text-main)' }}>{qc.checkItem}</p>
                                </div>
                                <div className="flex gap-1">
                                    {(['PASS', 'FAIL', 'NA'] as const).map((r) => (
                                        <button key={r}
                                            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer`}
                                            style={{
                                                background: qc.result === r ? (r === 'PASS' ? '#27AE6033' : r === 'FAIL' ? '#E74C3C33' : '#6B728033') : 'var(--bg-input)',
                                                color: qc.result === r ? (r === 'PASS' ? '#27AE60' : r === 'FAIL' ? '#E74C3C' : '#6B7280') : 'var(--text-dim)',
                                                border: `1px solid ${qc.result === r ? (r === 'PASS' ? '#27AE6055' : r === 'FAIL' ? '#E74C3C55' : '#6B728055') : 'var(--border-main)'}`,
                                            }}
                                            disabled={actionLoading}
                                            onClick={() => doAction(() => submitQC(id!, [{ checkItem: qc.checkItem, result: r }]))}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════ PHOTOS TAB ══════════════════ */}
            {activeTab === 'photos' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Repair Verification Photos</h3>
                            <p className="text-xs text-[var(--text-dim)]">Minimum 4 photos are required to release the vehicle.</p>
                        </div>
                        <div className={`p-2 px-3 rounded-xl border border-[var(--border-main)] flex items-center gap-2 ${wo.photos.length >= 4 ? 'bg-[var(--brand-lime-alpha)] border-[var(--brand-lime)]' : 'bg-[var(--bg-card)]'}`}>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={16} className={wo.photos.length >= 4 ? 'text-[var(--brand-lime)]' : 'text-[var(--text-dim)]'} />
                                <span className={`text-xs font-mono font-bold ${wo.photos.length >= 4 ? 'text-[var(--brand-lime)]' : 'text-[var(--text-main)]'}`}>
                                    {wo.photos.length} / 4
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[0, 1, 2, 3].map((index) => {
                            const photo = wo.photos[index];
                            return (
                                <div key={index} className="relative group">
                                    {photo ? (
                                        <div className="glass-card aspect-square rounded-2xl overflow-hidden border border-[var(--border-main)] hover:border-[var(--brand-lime)] transition-all duration-300">
                                            <img src={photo.url} alt={`Repair ${index + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute bottom-3 left-3 flex flex-col opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{photo.stage || 'Repair'}</span>
                                                <span className="text-[8px] text-white/70 font-mono italic">{new Date(photo.uploadedAt || '').toLocaleDateString()}</span>
                                            </div>
                                            <div className="absolute top-3 right-3 flex gap-1">
                                                <div className="badge badge-gray text-[9px] bg-black/50 backdrop-blur-md border-0 text-white font-mono">SLOT {index + 1}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-[var(--border-main)] hover:border-[var(--brand-lime)] hover:bg-[var(--brand-lime-alpha)] transition-all duration-300 cursor-pointer group shadow-sm bg-[var(--bg-card)]/50">
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) doAction(() => addPhotoFile(id!, file, 'IN_PROGRESS'));
                                                }}
                                                disabled={actionLoading}
                                            />
                                            <div className="w-14 h-14 rounded-full bg-[var(--bg-input)] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[var(--brand-lime)] transition-all duration-500 group-active:scale-95">
                                                <Camera size={28} className="text-[var(--text-dim)] group-hover:text-[var(--brand-black)]" />
                                            </div>
                                            <span className="text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors">Slot {index + 1}</span>
                                            <span className="text-[9px] font-medium text-[var(--text-dim)] uppercase tracking-widest mt-1 opacity-70">Click to Upload</span>
                                            {actionLoading && (
                                                <div className="absolute inset-0 bg-[var(--bg-card)]/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-20">
                                                    <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
                                                </div>
                                            )}
                                        </label>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {wo.photos.length > 4 && (
                        <div className="pt-6 animate-fadeInUp">
                            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 text-[var(--text-dim)]">Additional Photos ({wo.photos.length - 4})</h4>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {wo.photos.slice(4).map((p, idx) => (
                                    <div key={p._id} className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border-main)] group hover:border-[var(--brand-lime)] transition-all cursor-zoom-in">
                                        <img src={p.url} alt="Extra" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[8px] font-bold text-white uppercase tracking-widest">{p.stage}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Reusable Info Row ── */
const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-start gap-4">
        <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-sm text-right font-medium" style={{ color: 'var(--text-main)' }}>{value}</p>
    </div>
);

const PHASES = [
    { key: 'registration', label: 'Registration', statuses: ['DRAFT', 'START', 'REJECTED'] },
    { key: 'reception', label: 'Reception', statuses: ['VEHICLE_CHECKED_IN'] },
    { key: 'repair', label: 'Repair', statuses: ['PARTS_REQUESTED', 'PARTS_RECEIVED', 'IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'] },
    { key: 'qc', label: 'QC', statuses: ['QUALITY_CHECK', 'FAILED_QC'] },
    { key: 'release', label: 'Release', statuses: ['READY_FOR_RELEASE', 'VEHICLE_RELEASED'] },
];

const StatusStepper = ({ currentStatus, t_func }: { currentStatus: WorkOrderStatus; t_func: any }) => {
    const currentPhaseIndex = PHASES.findIndex(p => p.statuses.includes(currentStatus));

    return (
        <div className="glass-card p-4 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between min-w-[600px] px-2">
                {PHASES.map((phase, idx) => {
                    const isCompleted = idx < currentPhaseIndex;
                    const isActive = idx === currentPhaseIndex;
                    const isLast = idx === PHASES.length - 1;

                    return (
                        <div key={phase.key} className="flex-1 flex items-center">
                            <div className="flex flex-col items-center gap-2 relative">
                                <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 z-10 ${isCompleted ? 'bg-[var(--brand-lime)] text-[var(--brand-black)]' :
                                        isActive ? 'ring-4 ring-[var(--brand-lime-alpha)] bg-[var(--brand-lime)] text-[var(--brand-black)]' :
                                            'bg-[var(--bg-input)] text-[var(--text-dim)] border border-[var(--border-main)]'
                                        }`}
                                >
                                    {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                                </div>
                                <span
                                    className={`text-[10px] font-semibold whitespace-nowrap uppercase tracking-tighter ${isActive ? 'text-[var(--brand-lime)]' : 'text-[var(--text-dim)]'
                                        }`}
                                >
                                    {t_func(`workOrders.phases.${phase.key}`)}
                                </span>
                            </div>
                            {!isLast && (
                                <div className="flex-1 h-[2px] mx-2 mb-4 bg-[var(--bg-input)] overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--brand-lime)] transition-all duration-700 ease-in-out"
                                        style={{ width: isCompleted ? '100%' : '0%' }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default WorkOrderDetail;
