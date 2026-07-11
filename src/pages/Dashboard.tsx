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

    const STATUS_GROUPS = [
        {
            label: t('dashboard.groups.active'),
            statuses: ['LABOUR'] as WorkOrderStatus[],
            color: '#C8E600',
            icon: Wrench,
        },
        {
            label: t('dashboard.groups.awaiting'),
            statuses: ['TASKS'] as WorkOrderStatus[],
            color: '#3498DB',
            icon: Clock,
        },
        {
            label: t('dashboard.groups.qc'),
            statuses: ['QC_PHOTOS'] as WorkOrderStatus[],
            color: '#E67E22',
            icon: AlertTriangle,
        },
        {
            label: t('dashboard.groups.completed'),
            statuses: ['BILLING'] as WorkOrderStatus[],
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
                getWorkOrders({ branchId }),
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

    const totalInside = workOrders.filter(wo => !['BILLING', 'CANCELLED'].includes(wo.status)).length;
    const underPreventive = workOrders.filter(wo => wo.workOrderType === 'PREVENTIVE' && !['BILLING', 'CANCELLED'].includes(wo.status)).length;
    const underCorrective = workOrders.filter(wo => wo.workOrderType === 'CORRECTIVE' && !['BILLING', 'CANCELLED'].includes(wo.status)).length;
    const underAccident = workOrders.filter(wo => wo.workOrderType === 'ACCIDENT' && !['BILLING', 'CANCELLED'].includes(wo.status)).length;
    const underWearItem = workOrders.filter(wo => wo.workOrderType === 'WEAR_ITEM' && !['BILLING', 'CANCELLED'].includes(wo.status)).length;
    const anyOtherCategory = workOrders.filter(wo => !['PREVENTIVE', 'CORRECTIVE', 'ACCIDENT', 'WEAR_ITEM'].includes(wo.workOrderType) && !['BILLING', 'CANCELLED'].includes(wo.status)).length;
    const releasedInRange = workOrders.filter(wo => {
        const isReleasedStatus = ['BILLING'].includes(wo.status);
        if (!isReleasedStatus) return false;
        const dateToUse = wo.releasedAt || wo.updatedAt;
        if (!dateToUse) return false;
        const dateStr = dateToUse.split('T')[0];
        return dateStr >= startDate && dateStr <= endDate;
    }).length;



    const recentOrders = [...workOrders]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 8);

    const getStatusBadgeClass = (status: WorkOrderStatus) => {
        if (status === 'TASKS') return 'badge-blue';
        if (status === 'LABOUR') return 'badge-lime';
        if (status === 'QC_PHOTOS') return 'badge-orange';
        if (status === 'BILLING') return 'badge-green';
        if (status === 'CANCELLED') return 'badge-red';
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

            {/* KPI Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hero Card: Workshop Active Occupancy */}
                <div className="stat-card p-6 lg:col-span-1 flex flex-col justify-between cursor-pointer hover:border-opacity-50 transition-all duration-200"
                    style={{ borderColor: 'rgba(200, 230, 0, 0.25)', minHeight: '260px' }}
                    onClick={() => navigate('/work-orders')}
                >
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[11px] font-black uppercase tracking-widest text-lime" style={{ color: 'var(--brand-lime)' }}>
                                Workshop Active Occupancy
                            </span>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(200, 230, 0, 0.1)' }}>
                                <ClipboardList size={18} style={{ color: 'var(--brand-lime)' }} />
                            </div>
                        </div>
                        <div className="text-4xl font-extrabold text-white mb-1">{totalInside}</div>
                        <span className="text-xs text-gray-400">Total Vehicles Currently Inside Workshop</span>
                    </div>

                    {/* Stacked Proportional Bar Chart */}
                    <div className="mt-6 space-y-3">
                        <div className="h-2 w-full rounded-full overflow-hidden flex bg-white/5">
                            {totalInside > 0 ? (
                                <>
                                    <div style={{ width: `${(underPreventive / totalInside) * 100}%`, backgroundColor: '#27AE60' }} title="Preventive" />
                                    <div style={{ width: `${(underCorrective / totalInside) * 100}%`, backgroundColor: '#E67E22' }} title="Corrective" />
                                    <div style={{ width: `${(underAccident / totalInside) * 100}%`, backgroundColor: '#EF4444' }} title="Accident" />
                                    <div style={{ width: `${(underWearItem / totalInside) * 100}%`, backgroundColor: '#3498DB' }} title="Wear Item" />
                                    <div style={{ width: `${(anyOtherCategory / totalInside) * 100}%`, backgroundColor: '#9B59B6' }} title="Other" />
                                </>
                            ) : (
                                <div className="w-full bg-white/10" />
                            )}
                        </div>
                        
                        {/* Mini Legend */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-gray-400 font-medium">
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#27AE60' }} />
                                Prev: {underPreventive}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E67E22' }} />
                                Corr: {underCorrective}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
                                Acc: {underAccident}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#3498DB' }} />
                                Wear: {underWearItem}
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#9B59B6' }} />
                                Other: {anyOtherCategory}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sub KPI Cards Grid */}
                <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Preventive */}
                    <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                        style={{ borderColor: '#27AE6033' }}
                        onClick={() => navigate('/work-orders?type=PREVENTIVE')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#27AE601A' }}>
                                <Wrench size={20} style={{ color: '#27AE60' }} />
                            </div>
                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                        </div>
                        <div className="stat-value" style={{ color: '#27AE60' }}>{underPreventive}</div>
                        <div className="stat-label">UNDER PREVENTIVE MAINTENANCE</div>
                    </div>

                    {/* Corrective */}
                    <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                        style={{ borderColor: '#E67E2233' }}
                        onClick={() => navigate('/work-orders?type=CORRECTIVE')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#E67E221A' }}>
                                <Clock size={20} style={{ color: '#E67E22' }} />
                            </div>
                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                        </div>
                        <div className="stat-value" style={{ color: '#E67E22' }}>{underCorrective}</div>
                        <div className="stat-label">UNDER CORRECTIVE REPAIRING</div>
                    </div>

                    {/* Accident */}
                    <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                        style={{ borderColor: '#EF444433' }}
                        onClick={() => navigate('/work-orders?type=ACCIDENT')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#EF44441A' }}>
                                <AlertTriangle size={20} style={{ color: '#EF4444' }} />
                            </div>
                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                        </div>
                        <div className="stat-value" style={{ color: '#EF4444' }}>{underAccident}</div>
                        <div className="stat-label">UNDER ACCIDENT REPAIRING</div>
                    </div>

                    {/* Wear Item */}
                    <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                        style={{ borderColor: '#3498DB33' }}
                        onClick={() => navigate('/work-orders?type=WEAR_ITEM')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#3498DB1A' }}>
                                <Wrench size={20} style={{ color: '#3498DB' }} />
                            </div>
                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                        </div>
                        <div className="stat-value" style={{ color: '#3498DB' }}>{underWearItem}</div>
                        <div className="stat-label">UNDER WEAR ITEM REPLACEMENT</div>
                    </div>

                    {/* Other */}
                    <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                        style={{ borderColor: '#9B59B633' }}
                        onClick={() => navigate('/work-orders')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#9B59B61A' }}>
                                <ClipboardList size={20} style={{ color: '#9B59B6' }} />
                            </div>
                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                        </div>
                        <div className="stat-value" style={{ color: '#9B59B6' }}>{anyOtherCategory}</div>
                        <div className="stat-label">ANY OTHER CATEGORY</div>
                    </div>

                    {/* Released */}
                    <div className="stat-card group cursor-pointer hover:border-opacity-50 transition-all duration-200"
                        style={{ borderColor: '#2ECC7133' }}
                        onClick={() => navigate('/work-orders?status=VEHICLE_RELEASED')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#2ECC711A' }}>
                                <CheckCircle2 size={20} style={{ color: '#2ECC71' }} />
                            </div>
                            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-dim)' }} />
                        </div>
                        <div className="stat-value" style={{ color: '#2ECC71' }}>{releasedInRange}</div>
                        <div className="stat-label">TOTAL VEHICLE RELEASED/ DAY</div>
                    </div>
                </div>
            </div>

            {/* Low Stock Banner Alert */}
            {lowStockCount > 0 && (
                <div className="stat-card border-red bg-red/5 p-4 flex items-center justify-between cursor-pointer hover:bg-red/10 transition-all duration-200"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
                    onClick={() => navigate('/requirements?tab=low_stock')}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red/10">
                            <PackageMinus size={20} className="text-red-500 animate-pulse" style={{ color: '#EF4444' }} />
                        </div>
                        <div>
                            <div className="font-semibold text-white text-sm">Low Stock Inventory Alert!</div>
                            <p className="text-xs text-gray-400">There are {lowStockCount} parts currently running low in inventory. Click to view replenishment requirements.</p>
                        </div>
                    </div>
                    <ArrowRight size={18} className="text-gray-400" />
                </div>
            )}

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
