import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Search,
    Filter,
    PlusCircle,
    Loader2,
    ClipboardList,
    ChevronDown,
} from 'lucide-react';
import {
    getWorkOrders,
    type WorkOrder,
    type WorkOrderStatus,
    type Priority,
    type WorkOrderType,
} from '../services/workOrderService';

const STATUS_OPTIONS: WorkOrderStatus[] = [
    'DRAFT', 'START', 'REJECTED',
    'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED',
    'IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND',
    'QUALITY_CHECK', 'FAILED_QC', 'READY_FOR_RELEASE',
    'VEHICLE_RELEASED', 'INVOICED', 'CLOSED', 'CANCELLED',
];

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const TYPE_OPTIONS: WorkOrderType[] = [
    'PREVENTIVE', 'CORRECTIVE', 'PRE_ENTRY', 'ACCIDENT',
    'RETURN_INSPECTION', 'RECALL', 'SAFETY_PREP', 'WEAR_ITEM',
];

const WorkOrderList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        loadWorkOrders();
    }, [statusFilter, priorityFilter, typeFilter]);

    const loadWorkOrders = async () => {
        setLoading(true);
        try {
            const filters: Record<string, string> = {};
            if (statusFilter) filters.status = statusFilter;
            if (priorityFilter) filters.priority = priorityFilter;
            if (typeFilter) filters.workOrderType = typeFilter;
            const data = await getWorkOrders(filters);
            setWorkOrders(Array.isArray(data) ? data : []);
        } catch {
            // handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = workOrders.filter((wo) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            wo.workOrderNumber?.toLowerCase().includes(term) ||
            wo.faultDescription?.toLowerCase().includes(term) ||
            wo.workOrderType?.toLowerCase().includes(term)
        );
    });

    const getStatusBadgeClass = (status: WorkOrderStatus) => {
        if (['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'].includes(status)) return 'badge-lime';
        if (['DRAFT'].includes(status)) return 'badge-gray';
        if (['START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'].includes(status)) return 'badge-blue';
        if (['QUALITY_CHECK', 'FAILED_QC'].includes(status)) return 'badge-orange';
        if (['READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'CLOSED'].includes(status)) return 'badge-green';
        if (['REJECTED', 'CANCELLED'].includes(status)) return 'badge-red';
        return 'badge-gray';
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'CRITICAL': return 'badge-red';
            case 'HIGH': return 'badge-orange';
            case 'MEDIUM': return 'badge-lime';
            default: return 'badge-gray';
        }
    };

    const getVehicleLabel = (wo: WorkOrder) => {
        const v = wo.vehicleId;
        if (typeof v === 'object' && v !== null) {
            const bd = (v as Record<string, unknown>).basicDetails as Record<string, unknown> | undefined;
            if (bd) return `${bd.make || ''} ${bd.model || ''}`.trim();
        }
        return 'N/A';
    };

    const formatStatus = (s: string) => s.replace(/_/g, ' ');

    return (
        <div className="space-y-5 animate-fadeInUp">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                        {t('workOrders.list.title')}
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {filteredOrders.length} {t('workOrders.list.title').toLowerCase()}
                    </p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => navigate('/work-orders/create')}
                    id="create-work-order-btn"
                >
                    <PlusCircle size={18} />
                    {t('workOrders.list.new')}
                </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                        <input
                            type="text"
                            placeholder={t('workOrders.list.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10"
                            id="work-order-search"
                        />
                    </div>
                    <button
                        className={`btn-secondary ${showFilters ? '!border-lime !text-lime' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        style={showFilters ? { borderColor: 'var(--brand-lime)', color: 'var(--brand-lime)' } : {}}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">{t('common.dashboard')}</span>
                        <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t" style={{ borderColor: 'var(--border-main)' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field"
                            id="filter-status"
                        >
                            <option value="">{t('common.add').includes('Agre') ? 'Todos los Estados' : 'All Statuses'}</option>
                            {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{formatStatus(s)}</option>
                            ))}
                        </select>
                        <select
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="input-field"
                            id="filter-priority"
                        >
                            <option value="">{t('common.add').includes('Agre') ? 'Todas las Prioridades' : 'All Priorities'}</option>
                            {PRIORITY_OPTIONS.map((p) => (
                                <option key={p} value={p}>{t(`workOrders.priorities.${p.toLowerCase()}`, { defaultValue: p })}</option>
                            ))}
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="input-field"
                            id="filter-type"
                        >
                            <option value="">{t('common.add').includes('Agre') ? 'Todos los Tipos' : 'All Types'}</option>
                            {TYPE_OPTIONS.map((t_opt) => (
                                <option key={t_opt} value={t_opt}>{t(`workOrders.types.${t_opt.toLowerCase()}`, { defaultValue: t_opt.replace(/_/g, ' ') })}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Work Order Cards (mobile/tablet-friendly) */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-lime)' }} />
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <ClipboardList size={48} className="mx-auto mb-4 opacity-20" style={{ color: 'var(--text-dim)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-muted)' }}>No work orders found</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
                        {searchTerm || statusFilter || priorityFilter || typeFilter
                            ? 'Try adjusting your filters'
                            : 'Create your first work order to get started'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredOrders.map((wo) => (
                        <div
                            key={wo._id}
                            className="glass-card p-4 cursor-pointer transition-all duration-200 hover:border-opacity-60 active:scale-[0.98]"
                            onClick={() => navigate(`/work-orders/${wo._id}`)}
                            style={{ borderColor: 'var(--border-main)' }}
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="text-xs font-mono font-bold" style={{ color: 'var(--brand-lime)' }}>
                                        {wo.workOrderNumber}
                                    </p>
                                    <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text-main)' }}>
                                        {getVehicleLabel(wo)}
                                    </p>
                                </div>
                                <span className={`badge ${getPriorityBadge(wo.priority)}`}>
                                    {wo.priority}
                                </span>
                            </div>

                            {/* Fault Description */}
                            <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>
                                {wo.faultDescription}
                            </p>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                                <span className={`badge ${getStatusBadgeClass(wo.status)}`}>
                                    {formatStatus(wo.status)}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                                    {wo.workOrderType.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WorkOrderList;
