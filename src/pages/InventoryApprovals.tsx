import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle2, XCircle, AlertTriangle, Package, Loader2, RefreshCw,
    Search, ExternalLink, ShieldCheck, DollarSign, Layers, Wrench, ArrowRight
} from 'lucide-react';
import {
    getPendingInventoryApprovals, approvePart, rejectPart, approveAllParts,
    type PendingApprovalItem
} from '../services/workOrderService';
import { getUser } from '../utils/auth';
import toast from 'react-hot-toast';

export const InventoryApprovals = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = getUser();
    const branchId = (user?.branchId as string) || '';

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [items, setItems] = useState<PendingApprovalItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [rejectingPart, setRejectingPart] = useState<{ woId: string; partId: string; partName: string } | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchApprovals = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPendingInventoryApprovals({ branchId: branchId || undefined });
            setItems(data);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to load inventory approvals');
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    const handleApprove = async (woId: string, partId: string) => {
        setActionLoading(partId);
        try {
            await approvePart(woId, partId);
            toast.success('Part approved successfully');
            await fetchApprovals();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to approve part');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!rejectingPart) return;
        setActionLoading(rejectingPart.partId);
        try {
            await rejectPart(rejectingPart.woId, rejectingPart.partId, rejectionReason);
            toast.success('Part request rejected');
            setRejectingPart(null);
            setRejectionReason('');
            await fetchApprovals();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to reject part');
        } finally {
            setActionLoading(null);
        }
    };

    const handleApproveAll = async (woId: string, woNum: string) => {
        if (!window.confirm(`Approve all pending parts for Work Order ${woNum}?`)) return;
        setActionLoading(`wo-${woId}`);
        try {
            await approveAllParts(woId);
            toast.success(`Approved all pending parts for Work Order ${woNum}`);
            await fetchApprovals();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to approve parts');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredItems = items.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const woNum = (item.workOrderNumber || '').toLowerCase();
        const vehicleStr = `${item.vehicle?.make || ''} ${item.vehicle?.model || ''} ${item.vehicle?.registrationNumber || ''}`.toLowerCase();
        const partsStr = item.pendingParts.map(p => `${p.partName} ${p.partNumber || ''}`).join(' ').toLowerCase();
        return woNum.includes(q) || vehicleStr.includes(q) || partsStr.includes(q);
    });

    const totalPendingPartsCount = items.reduce((acc, curr) => acc + curr.pendingParts.length, 0);
    const totalPendingValue = items.reduce((acc, curr) => acc + curr.pendingParts.reduce((pAcc, p) => pAcc + (p.totalCost || 0), 0), 0);

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                        <ShieldCheck className="text-[var(--brand-lime)]" size={28} />
                        Inventory Approvals
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Review and approve auto-assigned work order parts before work orders can proceed to Labour & QC.
                    </p>
                </div>
                <button
                    onClick={fetchApprovals}
                    disabled={loading}
                    className="btn-secondary text-xs !py-2.5 !px-4 self-start md:self-auto flex items-center gap-2"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-5 border border-[var(--border-main)]/50 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Work Orders Pending</span>
                        <div className="text-2xl font-black text-white mt-1">{items.length}</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
                        <Wrench size={22} />
                    </div>
                </div>

                <div className="glass-card p-5 border border-[var(--border-main)]/50 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Parts Awaiting Approval</span>
                        <div className="text-2xl font-black text-[var(--brand-lime)] mt-1">{totalPendingPartsCount}</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] flex items-center justify-center">
                        <Layers size={22} />
                    </div>
                </div>

                <div className="glass-card p-5 border border-[var(--border-main)]/50 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Value Pending</span>
                        <div className="text-2xl font-black text-emerald-400 mt-1">${totalPendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <DollarSign size={22} />
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by Work Order #, Vehicle, or Part Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-11 w-full text-xs"
                />
            </div>

            {/* Approvals List */}
            {loading ? (
                <div className="glass-card p-12 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-[var(--brand-lime)] mb-3" />
                    <p className="text-xs text-muted-foreground">Loading inventory approvals...</p>
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <CheckCircle2 size={44} className="mx-auto text-emerald-400/30 mb-3" />
                    <h3 className="text-base font-bold text-white mb-1">All Clear! No Pending Approvals</h3>
                    <p className="text-xs text-muted-foreground">All auto-assigned parts have been reviewed and approved.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredItems.map(item => (
                        <div key={item.workOrderId} className="glass-card border border-[var(--border-main)]/60 rounded-2xl overflow-hidden shadow-lg">
                            {/* Card Header */}
                            <div className="p-4 bg-white/5 border-b border-[var(--border-main)]/40 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] flex items-center justify-center font-black text-sm">
                                        WO
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                onClick={() => navigate(`/work-orders/${item.workOrderId}`)}
                                                className="text-sm font-black text-white hover:text-[var(--brand-lime)] cursor-pointer transition-colors flex items-center gap-1.5"
                                            >
                                                {item.workOrderNumber}
                                                <ExternalLink size={12} className="opacity-60" />
                                            </span>
                                            <span className="badge badge-gray text-[10px] uppercase font-bold">{item.workOrderType.replace(/_/g, ' ')}</span>
                                            <span className="badge badge-lime text-[10px] uppercase font-bold">{item.status}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Vehicle: <strong className="text-white font-semibold">{item.vehicle ? `${item.vehicle.make || ''} ${item.vehicle.model || ''} (${item.vehicle.registrationNumber || 'No Plate'})` : 'N/A'}</strong>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApproveAll(item.workOrderId, item.workOrderNumber)}
                                        disabled={actionLoading === `wo-${item.workOrderId}`}
                                        className="btn-primary text-xs !py-2 !px-3 font-bold flex items-center gap-1.5"
                                    >
                                        {actionLoading === `wo-${item.workOrderId}` ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                        Approve All Parts ({item.pendingParts.length})
                                    </button>
                                </div>
                            </div>

                            {/* Pending Parts Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead>
                                        <tr className="border-b border-[var(--border-main)]/30 bg-black/20 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                            <th className="py-3 px-4">Part Details</th>
                                            <th className="py-3 px-4">Qty</th>
                                            <th className="py-3 px-4">Stock Status</th>
                                            <th className="py-3 px-4">Unit Cost</th>
                                            <th className="py-3 px-4">Total Cost</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-main)]/20">
                                        {item.pendingParts.map(part => {
                                            const isLoadingThis = actionLoading === part.partId;
                                            return (
                                                <tr key={part.partId} className="hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-3.5 px-4">
                                                        <div className="font-bold text-white flex items-center gap-2">
                                                            <Package size={14} className="text-muted-foreground shrink-0" />
                                                            {part.partName}
                                                        </div>
                                                        {part.partNumber && (
                                                            <span className="text-[10px] text-muted-foreground font-mono block mt-0.5 ml-5">
                                                                PN: {part.partNumber}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 font-bold text-white">{part.quantity}</td>
                                                    <td className="py-3.5 px-4">
                                                        {part.inStock ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <CheckCircle2 size={10} /> In Stock ({part.availableQuantity} available)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                                                <AlertTriangle size={10} /> Out of Stock ({part.availableQuantity} available)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 text-muted-foreground">${part.unitCost.toFixed(2)}</td>
                                                    <td className="py-3.5 px-4 font-bold text-emerald-400">${part.totalCost.toFixed(2)}</td>
                                                    <td className="py-3.5 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleApprove(item.workOrderId, part.partId)}
                                                                disabled={isLoadingThis}
                                                                className="btn-primary text-[11px] !py-1.5 !px-3 font-bold flex items-center gap-1"
                                                            >
                                                                {isLoadingThis ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => setRejectingPart({ woId: item.workOrderId, partId: part.partId, partName: part.partName })}
                                                                disabled={isLoadingThis}
                                                                className="btn-secondary !text-red-400 text-[11px] !py-1.5 !px-3 font-bold flex items-center gap-1 hover:!bg-red-500/20"
                                                            >
                                                                <XCircle size={12} />
                                                                Reject
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Rejection Modal */}
            {rejectingPart && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card p-6 rounded-2xl max-w-md w-full border border-red-500/30 space-y-4 animate-scaleUp">
                        <div className="flex items-center gap-3 text-red-400">
                            <XCircle size={24} />
                            <h3 className="text-base font-bold text-white">Reject Part Approval</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            You are rejecting part <strong className="text-white">{rejectingPart.partName}</strong>. Any stock reservations for this part will be released.
                        </p>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Reason for Rejection *</label>
                            <textarea
                                placeholder="Enter reason for rejecting this part request..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="input-field w-full min-h-[80px] text-xs"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => { setRejectingPart(null); setRejectionReason(''); }}
                                className="btn-secondary flex-1 text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={actionLoading === rejectingPart.partId}
                                className="btn-primary flex-1 text-xs !bg-red-600 hover:!bg-red-500"
                            >
                                {actionLoading === rejectingPart.partId ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
