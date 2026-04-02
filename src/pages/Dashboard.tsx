import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ClipboardList,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Wrench,
    ArrowRight,
    Loader2,
} from 'lucide-react';
import { getWorkOrders, type WorkOrder, type WorkOrderStatus } from '../services/workOrderService';

const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const STATUS_GROUPS: { label: string; statuses: WorkOrderStatus[]; color: string; icon: React.ElementType }[] = [
        {
            label: t('dashboard.groups.active'),
            statuses: ['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'],
            color: '#C8E600',
            icon: Wrench,
        },
        {
            label: t('dashboard.groups.awaiting'),
            statuses: ['DRAFT', 'PENDING_APPROVAL', 'START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'],
            color: '#3498DB',
            icon: Clock,
        },
        {
            label: t('dashboard.groups.qc'),
            statuses: ['QUALITY_CHECK', 'FAILED_QC', 'READY_FOR_RELEASE'],
            color: '#E67E22',
            icon: AlertTriangle,
        },
        {
            label: t('dashboard.groups.completed'),
            statuses: ['VEHICLE_RELEASED', 'INVOICED', 'CLOSED'],
            color: '#27AE60',
            icon: CheckCircle2,
        },
    ];

    useEffect(() => {
        loadWorkOrders();
    }, []);

    const loadWorkOrders = async () => {
        try {
            const data = await getWorkOrders();
            setWorkOrders(Array.isArray(data) ? data : []);
        } catch {
            // handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    const getCount = (statuses: WorkOrderStatus[]) =>
        workOrders.filter((wo) => statuses.includes(wo.status)).length;

    const recentOrders = [...workOrders]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8);

    const getStatusBadgeClass = (status: WorkOrderStatus) => {
        if (['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'].includes(status)) return 'badge-lime';
        if (['DRAFT', 'PENDING_APPROVAL'].includes(status)) return 'badge-gray';
        if (['START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'].includes(status)) return 'badge-blue';
        if (['QUALITY_CHECK', 'FAILED_QC'].includes(status)) return 'badge-orange';
        if (['READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'CLOSED'].includes(status)) return 'badge-green';
        if (['REJECTED', 'CANCELLED'].includes(status)) return 'badge-red';
        return 'badge-gray';
    };

    const formatStatus = (status: string) => status.replace(/_/g, ' ');

    const getVehicleLabel = (wo: WorkOrder) => {
        const v = wo.vehicleId;
        if (typeof v === 'object' && v !== null) {
            const bd = (v as Record<string, unknown>).basicDetails as Record<string, unknown> | undefined;
            if (bd) return `${bd.make || ''} ${bd.model || ''} ${bd.year || ''}`.trim();
        }
        return typeof v === 'string' ? v : 'N/A';
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'CRITICAL': return 'badge-red';
            case 'HIGH': return 'badge-orange';
            case 'MEDIUM': return 'badge-lime';
            default: return 'badge-gray';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-lime)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeInUp">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                    {t('dashboard.title')}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {t('dashboard.subtitle')}
                </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STATUS_GROUPS.map((group) => {
                    const count = getCount(group.statuses);
                    return (
                        <div key={group.label} className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                            style={{ borderColor: group.color + '33' }}
                            onClick={() => navigate('/work-orders')}
                        >
                            <div className="flex items-center justify-between">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: group.color + '1A' }}
                                >
                                    <group.icon size={20} style={{ color: group.color }} />
                                </div>
                                <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                            </div>
                            <div className="stat-value" style={{ color: group.color }}>{count}</div>
                            <div className="stat-label">{group.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* Recent Work Orders */}
            <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center gap-2">
                        <ClipboardList size={18} style={{ color: 'var(--brand-lime)' }} />
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                            {t('dashboard.recent')}
                        </h2>
                    </div>
                    <button
                        onClick={() => navigate('/work-orders')}
                        className="text-xs font-medium cursor-pointer"
                        style={{ color: 'var(--brand-lime)', background: 'none', border: 'none' }}
                    >
                        {t('dashboard.viewAll')}
                    </button>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="p-8 text-center">
                        <ClipboardList size={40} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-dim)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('workOrders.list.empty')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('dashboard.table.wo')}</th>
                                    <th>{t('dashboard.table.vehicle')}</th>
                                    <th>{t('dashboard.table.type')}</th>
                                    <th>{t('dashboard.table.priority')}</th>
                                    <th>{t('dashboard.table.status')}</th>
                                    <th>{t('dashboard.table.updated')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.map((wo) => (
                                    <tr
                                        key={wo._id}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/work-orders/${wo._id}`)}
                                    >
                                        <td className="font-mono text-xs font-semibold" style={{ color: 'var(--brand-lime)' }}>
                                            {wo.workOrderNumber}
                                        </td>
                                        <td className="text-sm">{getVehicleLabel(wo)}</td>
                                        <td className="text-xs">{wo.workOrderType.replace(/_/g, ' ')}</td>
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
                                        <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {new Date(wo.updatedAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
