import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, PlusCircle, Camera, X, Search, Package, Trash2 } from 'lucide-react';
import {
    createWorkOrder,
    type WorkOrderType,
    type Priority,
} from '../services/workOrderService';
import { getVehicles, type Vehicle } from '../services/vehicleService';
import { getParts, type InventoryPart } from '../services/inventoryService';
import { getUser } from '../utils/auth';
import toast from 'react-hot-toast';

const CreateWorkOrder = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = getUser();
    const branchId = (user?.branchId as string) || (user?.branch as string) || '';

    const WORK_ORDER_TYPES = [
        { value: 'PREVENTIVE', label: t('workOrders.types.preventive') },
        { value: 'CORRECTIVE', label: t('workOrders.types.corrective') },
        { value: 'PRE_ENTRY', label: t('workOrders.types.preEntry') },
        { value: 'ACCIDENT', label: t('workOrders.types.accident') },
        { value: 'RETURN_INSPECTION', label: t('workOrders.types.returnInspection') },
        { value: 'RECALL', label: t('workOrders.types.recall') },
        { value: 'SAFETY_PREP', label: t('workOrders.types.safetyPrep') },
        { value: 'WEAR_ITEM', label: t('workOrders.types.wearItem') },
    ];

    const PRIORITY_OPTIONS = [
        { value: 'LOW', label: t('workOrders.priorities.low'), color: '#6B7280' },
        { value: 'MEDIUM', label: t('workOrders.priorities.medium'), color: '#C8E600' },
        { value: 'HIGH', label: t('workOrders.priorities.high'), color: '#E67E22' },
        { value: 'CRITICAL', label: t('workOrders.priorities.critical'), color: '#E74C3C' },
    ];

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    /* ── Inventory Parts ── */
    const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
    const [loadingParts, setLoadingParts] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedParts, setSelectedParts] = useState<{ inventoryPartId: string, partName: string, quantity: number, unitCost: number }[]>([]);

    const [form, setForm] = useState({
        workOrderType: '' as string,
        vehicleId: '',
        priority: 'MEDIUM' as Priority,
        faultDescription: '',
        estimatedLabourHours: '',
        estimatedTotalCost: '',
        notes: '',
        requiredPhotos: [
            { label: 'Odometer Reading', stage: 'CHECK_IN', isMandatory: true },
            { label: 'Front View (Vehicle)', stage: 'CHECK_IN', isMandatory: true },
            { label: 'VIN Plate / Chassis Number', stage: 'CHECK_IN', isMandatory: true }
        ] as { label: string, stage: string, isMandatory: boolean }[],
    });

    useEffect(() => {
        loadVehicles();
        if (branchId) loadInventory();
    }, [branchId]);

    // Auto-calculate estimate
    useEffect(() => {
        const hours = Number(form.estimatedLabourHours) || 0;
        const partsCost = selectedParts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0);
        const calculated = (hours * 50) + partsCost;
        if (calculated > 0 || selectedParts.length > 0) {
            setForm(prev => ({ ...prev, estimatedTotalCost: calculated.toString() }));
        }
    }, [form.estimatedLabourHours, selectedParts]);

    const loadVehicles = async () => {
        try {
            const data = await getVehicles();
            setVehicles(Array.isArray(data) ? data : []);
        } catch {
            // handled by interceptor
        } finally {
            setLoadingVehicles(false);
        }
    };

    const loadInventory = async () => {
        setLoadingParts(true);
        try {
            const data = await getParts({ branchId, isActive: true });
            setInventoryParts(Array.isArray(data) ? data : []);
        } catch {
            // handled
        } finally {
            setLoadingParts(false);
        }
    };

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.workOrderType || !form.vehicleId || !form.faultDescription) {
            toast.error(t('workOrders.create.validation'));
            return;
        }

        if (!branchId) {
            toast.error(t('workOrders.create.noContext'));
            return;
        }

        setSubmitting(true);
        try {
            const partsCost = selectedParts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0);
            const payload = {
                workOrderType: form.workOrderType as WorkOrderType,
                vehicleId: form.vehicleId,
                branchId,
                priority: form.priority,
                faultDescription: form.faultDescription,
                estimatedLabourHours: form.estimatedLabourHours ? Number(form.estimatedLabourHours) : undefined,
                estimatedPartsCost: partsCost,
                estimatedTotalCost: form.estimatedTotalCost ? Number(form.estimatedTotalCost) : undefined,
                notes: form.notes || undefined,
                requiredPhotos: form.requiredPhotos,
                requiredParts: selectedParts.map(p => ({
                    inventoryPartId: p.inventoryPartId,
                    partName: p.partName,
                    quantity: p.quantity,
                    unitCost: p.unitCost
                }))
            };
            const result = await createWorkOrder(payload);
            toast.success(t('common.success'));
            navigate(`/work-orders/${result._id}`, { replace: true });
        } catch (error: any) {
            const message = error.response?.data?.message || t('common.error');
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeInUp">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button className="btn-icon" onClick={() => navigate(-1)} id="back-btn">
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
                        {t('workOrders.create.title')}
                    </h1>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.subtitle')}
                    </p>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
                {/* Work Order Type */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.type')} *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {WORK_ORDER_TYPES.map((t_type) => (
                            <button
                                key={t_type.value}
                                type="button"
                                onClick={() => handleChange('workOrderType', t_type.value)}
                                className="px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all duration-200 cursor-pointer"
                                style={{
                                    background: form.workOrderType === t_type.value ? 'var(--brand-lime)' : 'var(--bg-input)',
                                    color: form.workOrderType === t_type.value ? '#0A0A0A' : 'var(--text-main)',
                                    border: `1.5px solid ${form.workOrderType === t_type.value ? 'var(--brand-lime)' : 'var(--border-main)'}`,
                                    minHeight: '44px',
                                }}
                            >
                                {t_type.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Vehicle Selection */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.vehicle')} *
                    </label>
                    {loadingVehicles ? (
                        <div className="flex items-center gap-2 py-3">
                            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--brand-lime)' }} />
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('common.loading')}</span>
                        </div>
                    ) : (
                        <select
                            value={form.vehicleId}
                            onChange={(e) => handleChange('vehicleId', e.target.value)}
                            className="input-field"
                            id="vehicle-select"
                            required
                        >
                            <option value="">{t('workOrders.create.vehicle')}</option>
                            {vehicles.map((v) => (
                                <option key={v._id} value={v._id}>
                                    {v.basicDetails?.make} {v.basicDetails?.model} {v.basicDetails?.year}
                                    {v.basicDetails?.vin ? ` — ${v.basicDetails.vin}` : ''}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Priority */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.priority')}
                    </label>
                    <div className="flex gap-2">
                        {PRIORITY_OPTIONS.map((p) => (
                            <button
                                key={p.value}
                                type="button"
                                onClick={() => handleChange('priority', p.value)}
                                className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-center transition-all duration-200 cursor-pointer"
                                style={{
                                    background: form.priority === p.value ? p.color + '22' : 'var(--bg-input)',
                                    color: form.priority === p.value ? p.color : 'var(--text-muted)',
                                    border: `1.5px solid ${form.priority === p.value ? p.color : 'var(--border-main)'}`,
                                    minHeight: '44px',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fault Description */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.fault')} *
                    </label>
                    <textarea
                        value={form.faultDescription}
                        onChange={(e) => handleChange('faultDescription', e.target.value)}
                        placeholder={t('workOrders.create.faultPlaceholder')}
                        rows={4}
                        className="input-field resize-none"
                        id="fault-description"
                        required
                        style={{ minHeight: '100px' }}
                    />
                </div>

                {/* Estimates */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                            {t('workOrders.create.labourHrs')}
                        </label>
                        <input
                            type="number"
                            value={form.estimatedLabourHours}
                            onChange={(e) => handleChange('estimatedLabourHours', e.target.value)}
                            placeholder="0"
                            className="input-field"
                            min="0"
                            step="0.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                            {t('workOrders.create.partsCost') || "Parts Estimate"}
                        </label>
                        <div className="input-field bg-[var(--bg-input)]/50 cursor-not-allowed flex items-center font-bold">
                            ${selectedParts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0).toFixed(2)}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                            {t('workOrders.create.totalCost') || "Total Estimate"}
                        </label>
                        <input
                            type="number"
                            value={form.estimatedTotalCost}
                            onChange={(e) => handleChange('estimatedTotalCost', e.target.value)}
                            placeholder="0.00"
                            className="input-field"
                            style={{ 
                                border: `1.5px solid ${Number(form.estimatedTotalCost) <= 200 ? 'var(--brand-lime)' : '#E67E22'}` 
                            }}
                            min="0"
                            step="0.01"
                        />
                        {/* Approval Indicator */}
                        <div className="mt-2 flex items-center gap-1.5">
                            {Number(form.estimatedTotalCost) > 0 && (
                                Number(form.estimatedTotalCost) <= 200 ? (
                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(200, 230, 0, 0.1)', color: 'var(--brand-lime)' }}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                        Auto-Approved
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: 'rgba(230, 126, 34, 0.1)', color: '#E67E22' }}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                        Requires Manager Approval
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Required Parts Section */}
                <div className="space-y-4 pt-4 border-t border-[var(--border-main)]/50">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                            {t('workOrders.create.requiredParts') || 'Required Parts (Estimate)'}
                        </label>
                    </div>

                    {/* Part Search Dropdown */}
                    <div className="relative">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
                            <input
                                type="text"
                                placeholder="Search inventory (e.g. Brake Pad)..."
                                className="input-field pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        {searchTerm.length > 1 && (
                            <div className="absolute z-10 left-0 right-0 mt-1 glass-card shadow-xl max-h-60 overflow-y-auto border-[var(--border-main)] py-2">
                                {loadingParts ? (
                                    <div className="p-6 text-center space-y-2">
                                        <Loader2 size={24} className="animate-spin mx-auto opacity-20" />
                                        <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Fetching Inventory...</p>
                                    </div>
                                ) : (
                                    (() => {
                                        const filtered = inventoryParts.filter(p => 
                                            (p.partName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                             p.partNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
                                        );
                                        
                                        if (filtered.length === 0) {
                                            return (
                                                <div className="p-8 text-center opacity-40">
                                                    <Package size={24} className="mx-auto mb-2" />
                                                    <p className="text-xs font-semibold">No parts found for "{searchTerm}"</p>
                                                </div>
                                            );
                                        }

                                        return filtered.map(p => (
                                            <button
                                                key={p._id}
                                                type="button"
                                                className="w-full px-4 py-3 text-left hover:bg-[var(--brand-lime-alpha)] flex items-center justify-between group transition-colors border-b border-[var(--border-main)]/30 last:border-0"
                                                onClick={() => {
                                                    if (!selectedParts.some(sp => sp.inventoryPartId === p._id)) {
                                                        setSelectedParts(prev => [...prev, {
                                                            inventoryPartId: p._id,
                                                            partName: p.partName,
                                                            quantity: 1,
                                                            unitCost: p.unitCost
                                                        }]);
                                                    }
                                                    setSearchTerm('');
                                                }}
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-sm font-semibold truncate leading-tight mb-0.5">{p.partName}</p>
                                                    <p className="text-[10px] opacity-40 font-mono tracking-tighter uppercase">{p.partNumber} • {p.category}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-bold text-[var(--brand-lime)] leading-none mb-1">${p.unitCost}</p>
                                                    <p className="text-[10px] font-medium opacity-60 bg-[var(--bg-input)] px-1.5 py-0.5 rounded-md inline-block">{p.quantityOnHand} Left</p>
                                                </div>
                                            </button>
                                        ));
                                    })()
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Parts List */}
                    <div className="space-y-2">
                        {selectedParts.length === 0 ? (
                            <div className="p-8 rounded-2xl border-2 border-dashed border-[var(--border-main)] flex flex-col items-center justify-center opacity-20">
                                <Package size={32} className="mb-2" />
                                <p className="text-xs font-medium">No parts selected</p>
                            </div>
                        ) : (
                            selectedParts.map((p, idx) => (
                                <div key={p.inventoryPartId} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] group shadow-sm">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">{p.partName}</p>
                                        <p className="text-xs opacity-50 font-mono">${p.unitCost} / unit</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded-lg p-1 border border-[var(--border-main)]">
                                            <button type="button" onClick={() => {
                                                setSelectedParts(prev => prev.map((sp, i) => i === idx ? { ...sp, quantity: Math.max(1, sp.quantity - 1) } : sp));
                                            }} className="p-1 hover:bg-[var(--brand-lime-alpha)] rounded-md transition-colors font-bold w-6">-</button>
                                            <span className="text-sm font-mono font-bold w-6 text-center">{p.quantity}</span>
                                            <button type="button" onClick={() => {
                                                setSelectedParts(prev => prev.map((sp, i) => i === idx ? { ...sp, quantity: sp.quantity + 1 } : sp));
                                            }} className="p-1 hover:bg-[var(--brand-lime-alpha)] rounded-md transition-colors font-bold w-6">+</button>
                                        </div>
                                        
                                        <div className="text-right min-w-[70px]">
                                            <p className="text-sm font-bold">${(p.quantity * p.unitCost).toFixed(2)}</p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedParts(prev => prev.filter((_, i) => i !== idx))}
                                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        {t('workOrders.create.notes')}
                    </label>
                    <textarea
                        value={form.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        placeholder={t('workOrders.create.notesPlaceholder')}
                        rows={2}
                        className="input-field resize-none"
                    />
                </div>
                
                {/* Required Photos Configuration */}
                <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                            {t('workOrders.create.requiredPhotos') || 'Required Photos (QC)'}
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                const label = window.prompt('Enter photo requirement label (e.g. Engine Bay):');
                                if (label) {
                                    setForm(prev => ({
                                        ...prev,
                                        requiredPhotos: [...prev.requiredPhotos, { label, stage: 'QC', isMandatory: true }]
                                    }));
                                }
                            }}
                            className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-lime)] hover:opacity-80 flex items-center gap-1"
                        >
                            <PlusCircle size={12} /> Add Requirement
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2">
                        {form.requiredPhotos.map((rp, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] group shadow-sm transition-all hover:bg-[var(--bg-card)]">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-lg bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)]">
                                        <Camera size={14} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{rp.label}</p>
                                        <p className="text-[10px] uppercase tracking-tighter opacity-50 font-mono">{rp.stage.replace('_', ' ')} • {rp.isMandatory ? 'Mandatory' : 'Optional'}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm(prev => ({
                                            ...prev,
                                            requiredPhotos: prev.requiredPhotos.filter((_, i) => i !== idx)
                                        }));
                                    }}
                                    className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded-lg"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] italic" style={{ color: 'var(--text-dim)' }}>
                        * Technicians will be required to upload these specific photos before the vehicle can be released.
                    </p>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        className="btn-secondary flex-1"
                        onClick={() => navigate(-1)}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        className="btn-primary flex-1"
                        disabled={submitting}
                        id="submit-work-order"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                {t('workOrders.create.creating')}
                            </>
                        ) : (
                            <>
                                <PlusCircle size={18} />
                                {t('workOrders.create.submit')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateWorkOrder;
