import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, PlusCircle } from 'lucide-react';
import {
    createWorkOrder,
    type WorkOrderType,
    type Priority,
} from '../services/workOrderService';
import { getVehicles, type Vehicle } from '../services/vehicleService';
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

    const [form, setForm] = useState({
        workOrderType: '' as string,
        vehicleId: '',
        priority: 'MEDIUM' as Priority,
        faultDescription: '',
        estimatedLabourHours: '',
        estimatedPartsCost: '',
        estimatedTotalCost: '',
        notes: '',
    });

    useEffect(() => {
        loadVehicles();
    }, []);

    // Auto-calculate estimate
    useEffect(() => {
        const hours = Number(form.estimatedLabourHours) || 0;
        const parts = Number(form.estimatedPartsCost) || 0;
        const calculated = (hours * 50) + parts;
        if (calculated > 0) {
            setForm(prev => ({ ...prev, estimatedTotalCost: calculated.toString() }));
        }
    }, [form.estimatedLabourHours, form.estimatedPartsCost]);

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
            const payload = {
                workOrderType: form.workOrderType as WorkOrderType,
                vehicleId: form.vehicleId,
                branchId,
                priority: form.priority,
                faultDescription: form.faultDescription,
                estimatedLabourHours: form.estimatedLabourHours ? Number(form.estimatedLabourHours) : undefined,
                estimatedPartsCost: form.estimatedPartsCost ? Number(form.estimatedPartsCost) : undefined,
                estimatedTotalCost: form.estimatedTotalCost ? Number(form.estimatedTotalCost) : undefined,
                notes: form.notes || undefined,
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
                            {t('workOrders.create.partsCost')}
                        </label>
                        <input
                            type="number"
                            value={form.estimatedPartsCost}
                            onChange={(e) => handleChange('estimatedPartsCost', e.target.value)}
                            placeholder="0.00"
                            className="input-field"
                            min="0"
                            step="0.01"
                        />
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
