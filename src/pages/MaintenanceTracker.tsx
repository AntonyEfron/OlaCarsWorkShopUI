import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
    Wrench,
    Search,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    HelpCircle,
    User,
    Compass,
} from 'lucide-react';
import { getVehiclesDueForService, type DueForServiceVehicle } from '../services/vehicleService';
import { pullMaintenance, resolveAlert } from '../services/alertService';
import { toast } from 'react-hot-toast';

type FilterType = 'ALL' | 'DUE' | 'APPROACHING' | 'OK';

const MaintenanceTracker = () => {
    const { t } = useTranslation();
    const [vehicles, setVehicles] = useState<DueForServiceVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
    const [selectedVehicle, setSelectedVehicle] = useState<DueForServiceVehicle | null>(null);
    const [pullNotes, setPullNotes] = useState('');
    const [pulling, setPulling] = useState(false);

    // Pagination states
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [counts, setCounts] = useState({ all: 0, due: 0, approaching: 0, ok: 0 });

    useEffect(() => {
        loadData(page, activeFilter, searchQuery);
    }, [page, activeFilter, searchQuery]);

    const loadData = async (targetPage = page, filter = activeFilter, search = searchQuery) => {
        setLoading(true);
        try {
            const res = await getVehiclesDueForService(true, targetPage, limit, filter, search);
            setVehicles(res.data);
            setTotalPages(res.pagination.totalPages || 1);
            setTotalItems(res.pagination.total || 0);
            setCounts(res.counts || { all: 0, due: 0, approaching: 0, ok: 0 });
        } catch (error) {
            console.error('Error fetching due vehicles:', error);
            toast.error('Failed to load vehicles');
        } finally {
            setLoading(false);
        }
    };

    const handlePullRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVehicle) return;

        setPulling(true);
        try {
            const res = await pullMaintenance(selectedVehicle._id, pullNotes);
            if (res.success) {
                toast.success(res.message || 'Maintenance alert triggered successfully!');
                setSelectedVehicle(null);
                setPullNotes('');
                loadData(page); // refresh list
            } else {
                toast.error(res.message || 'Failed to pull maintenance');
            }
        } catch (error: any) {
            console.error('Error pulling maintenance:', error);
            toast.error(error.response?.data?.message || 'Error occurred during service pull request.');
        } finally {
            setPulling(false);
        }
    };

    const handleResolveAlert = async (alertId: string) => {
        try {
            const res = await resolveAlert(alertId);
            toast.success(res.message || 'Vehicle maintenance status resolved successfully!');
            loadData(page);
        } catch (error: any) {
            console.error('Error resolving maintenance:', error);
            toast.error(error.response?.data?.message || 'Error occurred during status resolution.');
        }
    };

    const getStatusBadge = (status: DueForServiceVehicle['serviceStatus']) => {
        switch (status) {
            case 'OVERDUE':
                return <span className="badge badge-red flex items-center gap-1"><AlertTriangle size={12} /> Overdue</span>;
            case 'APPROACHING':
                return <span className="badge badge-orange flex items-center gap-1"><Clock size={12} /> Approaching</span>;
            default:
                return <span className="badge badge-green flex items-center gap-1"><CheckCircle2 size={12} /> Good</span>;
        }
    };

    const getProgressColor = (percent: number) => {
        if (percent >= 100) return 'var(--alert-red)';
        if (percent >= 80) return 'var(--warn-orange)';
        return 'var(--brand-lime)';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <Loader2 size={32} className="animate-spin text-lime" style={{ color: 'var(--brand-lime)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeInUp">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                    Maintenance Tracker
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Track vehicles based on odometer distance and request preventative maintenance.
                </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 glass-card p-4">
                <div className="tab-nav flex-1 md:flex-initial">
                    <button
                        onClick={() => { setActiveFilter('ALL'); setPage(1); }}
                        className={`tab-btn ${activeFilter === 'ALL' ? 'active' : ''}`}
                    >
                        All ({counts.all})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('DUE'); setPage(1); }}
                        className={`tab-btn ${activeFilter === 'DUE' ? 'active' : ''}`}
                    >
                        Due Now ({counts.due})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('APPROACHING'); setPage(1); }}
                        className={`tab-btn ${activeFilter === 'APPROACHING' ? 'active' : ''}`}
                    >
                        Approaching ({counts.approaching})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('OK'); setPage(1); }}
                        className={`tab-btn ${activeFilter === 'OK' ? 'active' : ''}`}
                    >
                        Healthy ({counts.ok})
                    </button>
                </div>

                <div className="relative flex items-center md:w-80">
                    <Search size={18} className="absolute left-3.5" style={{ color: 'var(--text-dim)' }} />
                    <input
                        type="text"
                        placeholder="Search make, model, VIN..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                        className="input-field pl-10"
                    />
                </div>
            </div>

            {/* Main Table */}
            <div className="glass-card overflow-hidden">
                {vehicles.length === 0 ? (
                    <div className="p-12 text-center">
                        <Wrench size={48} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-dim)' }} />
                        <p className="text-base font-medium" style={{ color: 'var(--text-main)' }}>No vehicles found</p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>There are no vehicles matching the filter or search criteria.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                <tr>
                                    <th>Vehicle</th>
                                    <th>VIN</th>
                                    <th>Odometer</th>
                                    <th>Last Service</th>
                                    <th>Threshold</th>
                                    <th>% Progress</th>
                                    <th>Status</th>
                                    <th className="text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vehicles.map((vehicle) => {
                                    const make = vehicle.basicDetails?.make || '';
                                    const model = vehicle.basicDetails?.model || '';
                                    const year = vehicle.basicDetails?.year || '';
                                    const driverName = vehicle.currentDriver?.personalInfo?.fullName;

                                    return (
                                        <tr key={vehicle._id}>
                                            <td>
                                                <div>
                                                    <div className="font-semibold" style={{ color: 'var(--text-main)' }}>
                                                        {make} {model} <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({year})</span>
                                                    </div>
                                                    {driverName && (
                                                        <div className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                            <User size={12} /> {driverName}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-sm font-mono">{vehicle.basicDetails?.vin || 'N/A'}</td>
                                            <td className="text-sm font-semibold">{vehicle.basicDetails?.odometer?.toLocaleString()} km</td>
                                            <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{vehicle.lastServiceOdometer?.toLocaleString()} km</td>
                                            <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{vehicle.threshold?.toLocaleString()} km</td>
                                            <td className="w-1/5 min-w-[120px]">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-main)' }}>
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{
                                                                width: `${Math.min(100, vehicle.percentUsed)}%`,
                                                                backgroundColor: getProgressColor(vehicle.percentUsed),
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
                                                        {vehicle.percentUsed}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                {vehicle.isPulled ? (
                                                    <span className="badge flex items-center gap-1 font-semibold" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                                        <Wrench size={12} /> Pulled
                                                    </span>
                                                ) : (
                                                    getStatusBadge(vehicle.serviceStatus)
                                                )}
                                            </td>
                                            <td className="text-right">
                                                {vehicle.isPulled ? (
                                                    <button
                                                        onClick={() => vehicle.activeAlertId && handleResolveAlert(vehicle.activeAlertId)}
                                                        className="btn-secondary py-1 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500"
                                                        style={{ minHeight: 'unset' }}
                                                    >
                                                        <CheckCircle2 size={12} /> Repaired / Restore
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setSelectedVehicle(vehicle)}
                                                        className="btn-primary py-1 px-3 rounded-lg text-xs font-semibold cursor-pointer"
                                                        style={{ minHeight: 'unset' }}
                                                    >
                                                        <Wrench size={12} /> Pull Maintenance
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t" style={{ borderColor: 'var(--border-main)' }}>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Showing <span className="font-semibold" style={{ color: 'var(--text-main)' }}>{totalItems === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
                            <span className="font-semibold" style={{ color: 'var(--text-main)' }}>{Math.min(page * limit, totalItems)}</span> of{' '}
                            <span className="font-semibold" style={{ color: 'var(--text-main)' }}>{totalItems}</span> vehicles
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer`}
                                style={{
                                    background: 'none',
                                    borderColor: 'var(--border-main)',
                                    color: page === 1 ? 'var(--text-dim)' : 'var(--text-main)',
                                    opacity: page === 1 ? 0.4 : 1,
                                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => {
                                if (totalPages > 5 && Math.abs(p - page) > 1 && p !== 1 && p !== totalPages) {
                                    if (p === 2 || p === totalPages - 1) {
                                        return <span key={p} className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>...</span>;
                                    }
                                    return null;
                                }
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                        style={
                                            page === p
                                                ? { backgroundColor: 'var(--brand-lime)', color: '#09090b', border: '1px solid var(--brand-lime)' }
                                                : { background: 'none', border: '1px solid transparent', color: 'var(--text-main)' }
                                        }
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
                                style={{
                                    background: 'none',
                                    borderColor: 'var(--border-main)',
                                    color: page === totalPages ? 'var(--text-dim)' : 'var(--text-main)',
                                    opacity: page === totalPages ? 0.4 : 1,
                                    cursor: page === totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                    </>
                )}
            </div>


            {/* Pull Maintenance Modal (Portalled globally to document.body) */}
            {selectedVehicle && createPortal(
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--border-main)' }}>
                            <div className="flex items-center gap-2">
                                <Wrench style={{ color: 'var(--brand-lime)' }} size={20} />
                                <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                                    Pull Maintenance
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedVehicle(null)}
                                className="text-sm hover:opacity-75 cursor-pointer"
                                style={{ color: 'var(--text-muted)', background: 'none', border: 'none' }}
                            >
                                Close
                            </button>
                        </div>

                        <form onSubmit={handlePullRequest} className="mt-4 space-y-4">
                            <div>
                                <p className="text-sm" style={{ color: 'var(--text-main)' }}>
                                    Are you sure you want to flag <strong>{selectedVehicle.basicDetails?.make} {selectedVehicle.basicDetails?.model} ({selectedVehicle.basicDetails?.vin})</strong> for maintenance?
                                </p>
                                <p className="text-xs mt-2 p-2.5 rounded-lg border flex items-start gap-2" style={{ backgroundColor: 'var(--sidebar-hover)', borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
                                    <HelpCircle size={14} className="mt-0.5 flex-shrink-0" />
                                    This action generates a high-priority MAINTENANCE alert instantly notification to the main Dashboard panel and places a reminder banner on the driver dashboard.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-input)' }}>
                                <div>
                                    <span style={{ color: 'var(--text-dim)' }}>Current Odometer:</span>
                                    <div className="font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>
                                        {selectedVehicle.basicDetails?.odometer?.toLocaleString()} KM
                                    </div>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-dim)' }}>Since Last Service:</span>
                                    <div className="font-semibold mt-0.5" style={{ color: 'var(--text-main)' }}>
                                        {selectedVehicle.distanceSinceService?.toLocaleString()} KM
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Issue Description / Notes
                                </label>
                                <textarea
                                    value={pullNotes}
                                    onChange={(e) => setPullNotes(e.target.value)}
                                    placeholder="Enter details about why this service request is being pulled (e.g. Schedule Service, Engine check, Driver reported brake issue)"
                                    className="input-field w-full min-h-[80px] text-xs py-2 px-3 resize-none"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                                <button
                                    type="button"
                                    onClick={() => setSelectedVehicle(null)}
                                    className="btn-secondary py-2 px-4 rounded-xl text-xs"
                                    style={{ minHeight: 'unset' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={pulling}
                                    className="btn-primary py-2 px-4 rounded-xl text-xs flex items-center gap-1.5"
                                    style={{ minHeight: 'unset' }}
                                >
                                    {pulling ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            Flagging...
                                        </>
                                    ) : (
                                        <>
                                            <Wrench size={12} /> Confirm Pull
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MaintenanceTracker;
