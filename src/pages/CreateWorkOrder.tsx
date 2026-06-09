import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, PlusCircle, Camera, X, Search } from 'lucide-react';
import {
    createWorkOrder,
    type WorkOrderType,
    type Priority,
} from '../services/workOrderService';
import { getVehicles, type Vehicle } from '../services/vehicleService';
import { getBranchId } from '../utils/auth';
import toast from 'react-hot-toast';

const CreateWorkOrder = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const branchId = getBranchId() || '';

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
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
    const [selectedVehicleData, setSelectedVehicleData] = useState<Vehicle | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        workOrderType: '' as string,
        vehicleId: '',
        priority: 'MEDIUM' as Priority,
        faultDescription: '',
        notes: '',
        requiredPhotos: [
            { label: 'Odometer Reading', stage: 'CHECK_IN', isMandatory: true },
            { label: 'Front View (Vehicle)', stage: 'CHECK_IN', isMandatory: true },
            { label: 'VIN Plate / Chassis Number', stage: 'CHECK_IN', isMandatory: true }
        ] as { label: string, stage: string, isMandatory: boolean }[],
    });

    // Debounced backend vehicle search
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (vehicleSearchTerm.length > 1) {
                setLoadingVehicles(true);
                try {
                    const data = await getVehicles(vehicleSearchTerm);
                    setVehicles(Array.isArray(data) ? data : []);
                } catch {
                    // handled by interceptor
                } finally {
                    setLoadingVehicles(false);
                }
            } else {
                setVehicles([]);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(handler);
    }, [vehicleSearchTerm]);

    const handleChange = (field: string, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleVehicleSelect = (v: Vehicle) => {
        setSelectedVehicleData(v);
        handleChange('vehicleId', v._id);
        setVehicleSearchTerm('');
        setVehicles([]);
    };
    
    const handleVehicleClear = () => {
        setSelectedVehicleData(null);
        handleChange('vehicleId', '');
        setVehicleSearchTerm('');
        setVehicles([]);
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
            const payload = {
                workOrderType: form.workOrderType as WorkOrderType,
                vehicleId: form.vehicleId,
                branchId,
                priority: form.priority,
                faultDescription: form.faultDescription,
                notes: form.notes || undefined,
                requiredPhotos: form.requiredPhotos,
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
        <div className="max-w-4xl mx-auto space-y-4 animate-fadeInUp">
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
            <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left Column */}
                    <div className="space-y-4">
                        {/* Work Order Type */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                {t('workOrders.create.type')} *
                            </label>
                            <select
                                value={form.workOrderType}
                                onChange={(e) => handleChange('workOrderType', e.target.value)}
                                className="input-field"
                                required
                            >
                                <option value="" disabled hidden>
                                    {t('workOrders.create.selectType') || 'Select Work Order Type'}
                                </option>
                                {WORK_ORDER_TYPES.map((t_type) => (
                                    <option key={t_type.value} value={t_type.value}>
                                        {t_type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Vehicle Selection */}
                        <div className="relative">
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                {t('workOrders.create.vehicle')} *
                            </label>
                            {form.vehicleId && selectedVehicleData ? (
                                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] group shadow-sm">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">
                                            {selectedVehicleData.basicDetails?.make} {selectedVehicleData.basicDetails?.model} {selectedVehicleData.basicDetails?.year}
                                        </p>
                                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                            <p className="text-[10px] opacity-50 font-mono tracking-wider">
                                                {selectedVehicleData.basicDetails?.vin || 'No VIN provided'}
                                            </p>
                                            {selectedVehicleData.status === 'ACTIVE — RENTED' && (
                                                <span className="text-[9px] bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] px-1 rounded font-bold uppercase tracking-wider">
                                                    Rented
                                                </span>
                                            )}
                                            {selectedVehicleData.currentDriver && (
                                                <p className="text-[10px] opacity-60">
                                                    • Driver: <span className="font-semibold text-[var(--text-main)]">{selectedVehicleData.currentDriver.personalInfo?.fullName}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleVehicleClear}
                                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Search vehicle by VIN, make, or model..."
                                            className="input-field pl-9 text-xs"
                                            value={vehicleSearchTerm}
                                            onChange={(e) => setVehicleSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    
                                    {vehicleSearchTerm.length > 1 && (
                                        <div className="absolute z-10 left-0 right-0 mt-1 glass-card shadow-xl max-h-40 overflow-y-auto border-[var(--border-main)] py-1.5">
                                            {loadingVehicles ? (
                                                <div className="p-4 text-center opacity-40">
                                                    <Loader2 size={18} className="animate-spin mx-auto mb-1" />
                                                    <p className="text-[10px] font-semibold">Searching...</p>
                                                </div>
                                            ) : vehicles.length === 0 ? (
                                                <div className="p-4 text-center opacity-40">
                                                    <Search size={18} className="mx-auto mb-1" />
                                                    <p className="text-[10px] font-semibold">No vehicles found</p>
                                                </div>
                                            ) : (
                                                vehicles.map(v => (
                                                    <button
                                                        key={v._id}
                                                        type="button"
                                                        className="w-full px-3 py-2 text-left hover:bg-[var(--brand-lime-alpha)] flex items-center justify-between group transition-colors border-b border-[var(--border-main)]/30 last:border-0"
                                                        onClick={() => handleVehicleSelect(v)}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <p className="text-xs font-semibold truncate leading-tight">{v.basicDetails?.make} {v.basicDetails?.model} {v.basicDetails?.year}</p>
                                                                {v.status === 'ACTIVE — RENTED' && (
                                                                    <span className="text-[8px] bg-[var(--brand-lime)] text-black px-1 rounded font-bold uppercase">Rented</span>
                                                                )}
                                                            </div>
                                                            <p className="text-[9px] opacity-60 font-mono tracking-widest uppercase">{v.basicDetails?.vin || 'No VIN'}</p>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                {t('workOrders.create.priority')}
                            </label>
                            <div className="flex gap-1.5">
                                {PRIORITY_OPTIONS.map((p) => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => handleChange('priority', p.value)}
                                        className="flex-1 px-2 py-2 rounded-xl text-xs font-semibold text-center transition-all duration-200 cursor-pointer"
                                        style={{
                                            background: form.priority === p.value ? p.color + '22' : 'var(--bg-input)',
                                            color: form.priority === p.value ? p.color : 'var(--text-muted)',
                                            border: `1.5px solid ${form.priority === p.value ? p.color : 'var(--border-main)'}`,
                                            minHeight: '38px',
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                {t('workOrders.create.notes')}
                            </label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => handleChange('notes', e.target.value)}
                                placeholder={t('workOrders.create.notesPlaceholder')}
                                rows={2}
                                className="input-field resize-none text-xs"
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        {/* Fault Description */}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                {t('workOrders.create.fault')} *
                            </label>
                            <textarea
                                value={form.faultDescription}
                                onChange={(e) => handleChange('faultDescription', e.target.value)}
                                placeholder={t('workOrders.create.faultPlaceholder')}
                                rows={4}
                                className="input-field resize-none text-xs"
                                id="fault-description"
                                required
                                style={{ minHeight: '94px' }}
                            />
                        </div>

                        {/* Required Photos Configuration */}
                        <div className="space-y-2">
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
                                    className="text-[9px] font-bold uppercase tracking-wider text-[var(--brand-lime)] hover:opacity-80 flex items-center gap-1"
                                >
                                    <PlusCircle size={10} /> Add Requirement
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                                {form.requiredPhotos.map((rp, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-main)] group shadow-sm transition-all hover:bg-[var(--bg-card)]">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="p-1 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] flex-shrink-0">
                                                <Camera size={12} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold truncate leading-tight">{rp.label}</p>
                                                <p className="text-[8px] uppercase tracking-tighter opacity-50 font-mono">{rp.stage.replace('_', ' ')} • {rp.isMandatory ? 'Mandatory' : 'Optional'}</p>
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
                                            className="p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 rounded-lg flex-shrink-0"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-3 border-t border-[var(--border-main)]/30">
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
                                <Loader2 size={16} className="animate-spin" />
                                {t('workOrders.create.creating')}
                            </>
                        ) : (
                            <>
                                <PlusCircle size={16} />
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
