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
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import {
    getWorkOrders,
    type WorkOrder,
    type WorkOrderStatus,
    type Priority,
    type WorkOrderType,
} from '../services/workOrderService';

const STATUS_OPTIONS: WorkOrderStatus[] = [
    'DRAFT', 'START',
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
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [priorityFilter, setPriorityFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Sorting State
    const [sortBy, setSortBy] = useState<string>('updatedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [limit] = useState(10);
    const [pagination, setPagination] = useState<{
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    } | null>(null);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Load work orders when filters or page change
    useEffect(() => {
        loadWorkOrders();
    }, [statusFilter, priorityFilter, typeFilter, currentPage, debouncedSearchTerm]);

    const loadWorkOrders = async () => {
        setLoading(true);
        try {
            const filters: Record<string, any> = {
                page: currentPage,
                limit: limit,
            };
            if (statusFilter) filters.status = statusFilter;
            if (priorityFilter) filters.priority = priorityFilter;
            if (typeFilter) filters.workOrderType = typeFilter;
            if (debouncedSearchTerm.trim()) filters.search = debouncedSearchTerm.trim();

            const res = await getWorkOrders(filters);
            if (res && res.data) {
                setWorkOrders(Array.isArray(res.data) ? res.data : []);
                setPagination(res.pagination || null);
            } else {
                setWorkOrders(Array.isArray(res) ? res : []);
                setPagination(null);
            }
        } catch {
            // handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortBy !== field) return <span className="opacity-30 ml-1 inline-block"><ChevronDown size={12} /></span>;
        return (
            <span className={`inline-block ml-1 transition-transform duration-200 ${sortOrder === 'asc' ? 'rotate-180' : ''}`}>
                <ChevronDown size={12} className="text-lime" style={{ color: 'var(--brand-lime)' }} />
            </span>
        );
    };

    const getVehicleLabel = (wo: WorkOrder) => {
        const v = wo.vehicleId;
        if (typeof v === 'object' && v !== null) {
            const bd = (v as Record<string, unknown>).basicDetails as Record<string, unknown> | undefined;
            if (bd) return `${bd.make || ''} ${bd.model || ''}`.trim();
        }
        return 'N/A';
    };

    const getStatusBadgeClass = (status: WorkOrderStatus) => {
        if (['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'].includes(status)) return 'badge-lime';
        if (['DRAFT'].includes(status)) return 'badge-gray';
        if (['START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'].includes(status)) return 'badge-blue';
        if (['QUALITY_CHECK', 'FAILED_QC'].includes(status)) return 'badge-orange';
        if (['READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'CLOSED'].includes(status)) return 'badge-green';
        if (['CANCELLED'].includes(status)) return 'badge-red';
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

    const formatStatus = (s: string) => s.replace(/_/g, ' ');

    const handlePageChange = (newPage: number) => {
        if (pagination && newPage >= 1 && newPage <= pagination.totalPages) {
            setCurrentPage(newPage);
        }
    };

    // Local client-side sorting on the current page's results
    const sortedOrders = [...workOrders].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        if (sortBy === 'workOrderNumber') {
            valA = a.workOrderNumber || '';
            valB = b.workOrderNumber || '';
        } else if (sortBy === 'vehicle') {
            valA = getVehicleLabel(a);
            valB = getVehicleLabel(b);
        } else if (sortBy === 'type') {
            valA = a.workOrderType || '';
            valB = b.workOrderType || '';
        } else if (sortBy === 'priority') {
            const weight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
            valA = weight[a.priority] || 0;
            valB = weight[b.priority] || 0;
        } else if (sortBy === 'status') {
            valA = a.status || '';
            valB = b.status || '';
        } else if (sortBy === 'updatedAt') {
            valA = new Date(a.updatedAt || a.createdAt).getTime();
            valB = new Date(b.updatedAt || b.createdAt).getTime();
        }
        
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    return (
        <div className="space-y-5 animate-fadeInUp">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                        {t('workOrders.list.title')}
                    </h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {pagination ? pagination.total : workOrders.length} {t('workOrders.list.title').toLowerCase()}
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
                            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
                            onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }}
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
                            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
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

            {/* Work Order Table */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-lime)' }} />
                </div>
            ) : workOrders.length === 0 ? (
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
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th className="pl-6 cursor-pointer select-none group hover:text-lime transition-colors" onClick={() => handleSort('workOrderNumber')}>
                                        <div className="flex items-center">
                                            {t('dashboard.table.wo')}
                                            <SortIcon field="workOrderNumber" />
                                        </div>
                                    </th>
                                    <th className="cursor-pointer select-none group hover:text-lime transition-colors" onClick={() => handleSort('vehicle')}>
                                        <div className="flex items-center">
                                            {t('dashboard.table.vehicle')}
                                            <SortIcon field="vehicle" />
                                        </div>
                                    </th>
                                    <th className="cursor-pointer select-none group hover:text-lime transition-colors" onClick={() => handleSort('type')}>
                                        <div className="flex items-center">
                                            {t('dashboard.table.type')}
                                            <SortIcon field="type" />
                                        </div>
                                    </th>
                                    <th>{t('workOrders.create.fault')}</th>
                                    <th className="cursor-pointer select-none group hover:text-lime transition-colors" onClick={() => handleSort('priority')}>
                                        <div className="flex items-center">
                                            {t('dashboard.table.priority')}
                                            <SortIcon field="priority" />
                                        </div>
                                    </th>
                                    <th className="cursor-pointer select-none group hover:text-lime transition-colors" onClick={() => handleSort('status')}>
                                        <div className="flex items-center">
                                            {t('dashboard.table.status')}
                                            <SortIcon field="status" />
                                        </div>
                                    </th>
                                    <th className="pr-6 cursor-pointer select-none group hover:text-lime transition-colors" onClick={() => handleSort('updatedAt')}>
                                        <div className="flex items-center">
                                            {t('dashboard.table.updated')}
                                            <SortIcon field="updatedAt" />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedOrders.map((wo) => (
                                    <tr
                                        key={wo._id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/work-orders/${wo._id}`)}
                                    >
                                        <td className="pl-6 font-mono text-xs font-bold" style={{ color: 'var(--brand-lime)' }}>
                                            {wo.workOrderNumber}
                                        </td>
                                        <td className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                                            {getVehicleLabel(wo)}
                                        </td>
                                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {wo.workOrderType.replace(/_/g, ' ')}
                                        </td>
                                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <div className="line-clamp-1 max-w-xs" title={wo.faultDescription}>
                                                {wo.faultDescription}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge ${getPriorityBadge(wo.priority)}`}>
                                                {wo.priority}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${getStatusBadgeClass(wo.status)}`}>
                                                {formatStatus(wo.status)}
                                            </span>
                                        </td>
                                        <td className="pr-6 text-xs" style={{ color: 'var(--text-dim)' }}>
                                            {new Date(wo.updatedAt || wo.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors" style={{ borderColor: 'var(--border-main)', background: 'rgba(0,0,0,0.01)' }}>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>
                                {t('common.add').includes('Agre') 
                                    ? `Mostrando ${workOrders.length} de ${pagination.total} registros` 
                                    : `Showing ${workOrders.length} of ${pagination.total} records`}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1 || loading}
                                    className="p-2 rounded-lg border transition-all hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                    style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(pagination.totalPages)].map((_, i) => (
                                        <button
                                            key={i + 1}
                                            onClick={() => handlePageChange(i + 1)}
                                            className={`w-9 h-9 rounded-lg text-xs font-black transition-all ${currentPage === i + 1 ? 'shadow-lg' : 'hover:bg-black/5'}`}
                                            style={{ 
                                                background: currentPage === i + 1 ? 'var(--brand-lime)' : 'transparent',
                                                color: currentPage === i + 1 ? '#000' : 'var(--text-main)',
                                                border: currentPage === i + 1 ? 'none' : '1px solid var(--border-main)'
                                            }}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === pagination.totalPages || loading}
                                    className="p-2 rounded-lg border transition-all hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
                                    style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkOrderList;
