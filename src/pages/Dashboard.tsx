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
    PackageMinus,
} from 'lucide-react';
import { getWorkOrders, type WorkOrder, type WorkOrderStatus } from '../services/workOrderService';
import { getLowStock } from '../services/inventoryService';
import { getWorkshopAnalytics, type WorkshopAnalyticsData } from '../services/dashboardService';
import { getBranchId } from '../utils/auth';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, Legend, Cell, PieChart, Pie, LineChart, Line
} from 'recharts';

const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [analytics, setAnalytics] = useState<WorkshopAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const branchId = getBranchId() || '';

    // Date range for analytics
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const STATUS_GROUPS: { label: string; statuses: WorkOrderStatus[]; color: string; icon: React.ElementType }[] = [
        {
            label: t('dashboard.groups.active'),
            statuses: ['IN_PROGRESS', 'PAUSED', 'ADDITIONAL_WORK_FOUND'],
            color: '#C8E600',
            icon: Wrench,
        },
        {
            label: t('dashboard.groups.awaiting'),
            statuses: ['DRAFT', 'START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'],
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
        loadData();
    }, [branchId, startDate, endDate]);

    const loadData = async () => {
        try {
            const [woData, lowStockData, analyticsData] = await Promise.all([
                getWorkOrders(),
                getLowStock(branchId),
                getWorkshopAnalytics(branchId, startDate, endDate)
            ]);
            setWorkOrders(Array.isArray(woData) ? woData : []);
            setLowStockCount(Array.isArray(lowStockData) ? lowStockData.length : 0);
            setAnalytics(analyticsData);
            console.log('Dashboard Analytics Received:', analyticsData);
        } catch (error) {
            console.error('Dashboard Data Fetch Error:', error);
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
        if (['DRAFT'].includes(status)) return 'badge-gray';
        if (['START', 'VEHICLE_CHECKED_IN', 'PARTS_REQUESTED', 'PARTS_RECEIVED'].includes(status)) return 'badge-blue';
        if (['QUALITY_CHECK', 'FAILED_QC'].includes(status)) return 'badge-orange';
        if (['READY_FOR_RELEASE', 'VEHICLE_RELEASED', 'CLOSED'].includes(status)) return 'badge-green';
        if (['CANCELLED'].includes(status)) return 'badge-red';
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                        {t('dashboard.title')}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {t('dashboard.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border text-sm"
                        style={{ 
                            backgroundColor: 'var(--bg-card)', 
                            borderColor: 'var(--border-main)',
                            color: 'var(--text-main)'
                        }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>to</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border text-sm"
                        style={{ 
                            backgroundColor: 'var(--bg-card)', 
                            borderColor: 'var(--border-main)',
                            color: 'var(--text-main)'
                        }}
                    />
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {STATUS_GROUPS.map((group) => {
                    const count = getCount(group.statuses);
                    return (
                        <div key={group.label} className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                            style={{ borderColor: group.color + '33' }}
                            onClick={() => navigate('/work-orders')}
                        >
                            <div className="flex items-center justify-between">
                                <div
                                    className="w-5 h-5 rounded-xl flex items-center justify-center"
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

                {/* Low Stock KPI */}
                <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                    style={{ borderColor: '#EF444433' }}
                    onClick={() => navigate('/requirements?tab=low_stock')}
                >
                    <div className="flex items-center justify-between">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: '#EF44441A' }}
                        >
                            <PackageMinus size={20} style={{ color: '#EF4444' }} />
                        </div>
                        <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                    </div>
                    <div className="stat-value" style={{ color: '#EF4444' }}>{lowStockCount}</div>
                    <div className="stat-label">Low Stock Parts</div>
                </div>
            </div>

            {/* Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card lg:col-span-2 p-5 flex flex-col">
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-main)' }}>Work Orders Frequency & Completion</h2>
                    <div className="w-full" style={{ minHeight: '400px' }}>
                        {analytics?.workOrderTrends && analytics.workOrderTrends.some(d => d.created > 0 || d.completed > 0) ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart data={analytics.workOrderTrends} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                                    <XAxis 
                                        dataKey="date" 
                                        stroke="#9CA3AF"
                                        fontSize={12}
                                        tickLine={true}
                                        axisLine={true}
                                    />
                                    <YAxis 
                                        stroke="#9CA3AF"
                                        fontSize={12}
                                        tickLine={true}
                                        axisLine={true}
                                    />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#1C1C1C', borderColor: '#374151', borderRadius: '8px', fontSize: '12px', color: '#FFFFFF' }}
                                        itemStyle={{ color: '#FFFFFF' }}
                                    />
                                    <Legend verticalAlign="top" height={36} iconType="circle" />
                                    <Line type="monotone" name="Created" dataKey="created" stroke="#C8E600" strokeWidth={3} dot={{ r: 5, fill: '#C8E600' }} activeDot={{ r: 7 }} />
                                    <Line type="monotone" name="Completed" dataKey="completed" stroke="#3498DB" strokeWidth={3} dot={{ r: 5, fill: '#3498DB' }} activeDot={{ r: 7 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full w-full border border-dashed rounded-lg" style={{ borderColor: 'var(--border-main)' }}>
                                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                    <AlertTriangle size={16} />
                                    {t('dashboard.noData')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card p-5 flex flex-col">
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-main)' }}>Stock Health</h2>
                    <div className="w-full" style={{ minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {analytics?.stockHealth && analytics.stockHealth.length > 0 && analytics.stockHealth.some(s => s.value > 0) ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <PieChart>
                                    <Pie
                                        data={analytics.stockHealth}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {analytics.stockHealth.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'Healthy' ? '#27AE60' : '#EF4444'} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: '#1C1C1C', borderColor: '#2A2A2A', borderRadius: '8px', fontSize: '12px', color: '#FFFFFF' }}
                                        itemStyle={{ color: '#FFFFFF' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" verticalAlign="bottom" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full w-full border border-dashed rounded-lg" style={{ borderColor: 'var(--border-main)' }}>
                                <p className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                    <AlertTriangle size={16} />
                                    {t('dashboard.noData')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
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
