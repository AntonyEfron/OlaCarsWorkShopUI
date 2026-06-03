import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    Filter,
    AlertCircle,
    CheckCircle,
    Package,
    PlusCircle,
    X,
    Loader2,
    Eye,
    ShieldAlert,
    Coins,
    Calendar,
    FileText,
    ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWriteOffs, createWriteOff, type WriteOff } from '../services/writeOffService';
import { getParts, type InventoryPart } from '../services/inventoryService';

const WriteOffList = () => {
    const { t } = useTranslation();
    const [writeOffs, setWriteOffs] = useState<WriteOff[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal state for Add Write-Off
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // Inventory search inside Add modal
    const [partSearch, setPartSearch] = useState('');
    const [partResults, setPartResults] = useState<InventoryPart[]>([]);
    const [searchingParts, setSearchingParts] = useState(false);
    const [selectedPart, setSelectedPart] = useState<InventoryPart | null>(null);

    // Form inputs
    const [quantity, setQuantity] = useState<number>(1);
    const [reason, setReason] = useState('');
    const [docUrl, setDocUrl] = useState('');

    // Modal state for details
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<WriteOff | null>(null);

    useEffect(() => {
        loadWriteOffs();
    }, [searchTerm, statusFilter]);

    // Query inventory parts when user types search query in Add modal
    useEffect(() => {
        if (!partSearch.trim()) {
            setPartResults([]);
            return;
        }
        const timer = setTimeout(() => {
            searchInventoryParts();
        }, 300);
        return () => clearTimeout(timer);
    }, [partSearch]);

    const loadWriteOffs = async () => {
        setLoading(true);
        try {
            const data = await getWriteOffs({
                status: statusFilter || undefined,
                search: searchTerm || undefined,
            });
            setWriteOffs(Array.isArray(data) ? data : []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load write-off logs');
        } finally {
            setLoading(false);
        }
    };

    const searchInventoryParts = async () => {
        setSearchingParts(true);
        try {
            const data = await getParts({ search: partSearch });
            setPartResults(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to search inventory parts:', error);
        } finally {
            setSearchingParts(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPart) {
            toast.error('Please select a part from inventory');
            return;
        }
        if (quantity > selectedPart.quantityOnHand) {
            toast.error(`Cannot write off more than available stock (${selectedPart.quantityOnHand})`);
            return;
        }

        setSubmitting(true);
        try {
            await createWriteOff({
                partId: selectedPart._id,
                quantity: quantity,
                reason: reason,
                documents: docUrl ? [docUrl] : [],
            });

            toast.success('Write-off request submitted successfully');
            setShowAddModal(false);
            resetForm();
            loadWriteOffs();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to submit write-off request');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setSelectedPart(null);
        setPartSearch('');
        setQuantity(1);
        setReason('');
        setDocUrl('');
        setPartResults([]);
    };

    const handleViewDetails = (item: WriteOff) => {
        setSelectedItem(item);
        setShowDetailsModal(true);
    };

    const getStatusBadge = (status: WriteOff['status']) => {
        switch (status) {
            case 'PENDING':
                return {
                    class: 'badge-orange',
                    label: 'Pending Approval',
                    icon: <AlertCircle size={12} className="mr-1 inline" />,
                };
            case 'APPROVED':
                return {
                    class: 'badge-green',
                    label: 'Approved & Deducted',
                    icon: <CheckCircle size={12} className="mr-1 inline" />,
                };
            case 'REJECTED':
                return {
                    class: 'badge-red',
                    label: 'Rejected',
                    icon: <X size={12} className="mr-1 inline" />,
                };
            default:
                return {
                    class: 'badge-gray',
                    label: status,
                    icon: null,
                };
        }
    };

    const formatId = (id: string) => {
        if (!id) return '';
        if (id.startsWith('WOFF-')) return id;
        return `WOFF-${id.substring(id.length - 6).toUpperCase()}`;
    };

    // Calculate dynamic loss
    const calculatedLoss = selectedPart ? quantity * selectedPart.unitCost : 0;

    return (
        <div className="space-y-6 animate-fadeInUp">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                        <ShieldAlert size={24} className="text-[var(--sidebar-active)]" />
                        Inventory Write-Offs
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Log damaged, lost, or decommissioned parts and request finance approvals.
                    </p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => { resetForm(); setShowAddModal(true); }}
                >
                    <PlusCircle size={18} />
                    New Write-Off Request
                </button>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <span className="stat-label">Pending Approval Value</span>
                    <span className="stat-value text-orange-500">
                        ${writeOffs
                            .filter(w => w.status === 'PENDING')
                            .reduce((sum, w) => sum + w.amountLoss, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Value of write-offs awaiting clearance</p>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Total Approved Losses</span>
                    <span className="stat-value text-red-500">
                        ${writeOffs
                            .filter(w => w.status === 'APPROVED')
                            .reduce((sum, w) => sum + w.amountLoss, 0)
                            .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Deducted inventory value losses</p>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Pending Approval Count</span>
                    <span className="stat-value" style={{ color: 'var(--text-main)' }}>
                        {writeOffs.filter(w => w.status === 'PENDING').length} requests
                    </span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Write-off logs awaiting admin action</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                        <input
                            type="text"
                            placeholder="Search by request number, part name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10"
                        />
                    </div>
                    <button
                        className={`btn-secondary ${statusFilter || showFilters ? '!border-lime !text-lime' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter size={16} /> Filters
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-main)' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field max-w-[200px]"
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Write Offs Table */}
            <div className="glass-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin text-[var(--sidebar-active)]" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Request #</th>
                                    <th>Part Details</th>
                                    <th className="text-center">Qty</th>
                                    <th>Unit Cost</th>
                                    <th>Total Loss</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {writeOffs.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 opacity-40">
                                            <Package size={40} className="mx-auto mb-3" />
                                            <p>No write-off requests found.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    writeOffs.map((item) => {
                                        const badge = getStatusBadge(item.status);
                                        return (
                                            <tr key={item._id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="font-mono text-xs font-bold" style={{ color: 'var(--sidebar-active)' }}>
                                                    {item.requestNumber || formatId(item._id)}
                                                </td>
                                                <td>
                                                    <div className="font-bold" style={{ color: 'var(--text-main)' }}>
                                                        {item.part?.partName || 'Unknown Part'}
                                                    </div>
                                                    {item.part?.partNumber && (
                                                        <div className="text-[10px] font-mono opacity-50 uppercase">
                                                            {item.part.partNumber}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center font-mono font-semibold">
                                                    {item.quantity} {item.part?.unit || 'pc'}
                                                </td>
                                                <td className="font-mono opacity-80">
                                                    ${item.unitCost?.toFixed(2)}
                                                </td>
                                                <td className="font-mono font-bold text-red-500">
                                                    ${item.amountLoss?.toFixed(2)}
                                                </td>
                                                <td className="max-w-[200px] truncate opacity-70" title={item.reason}>
                                                    {item.reason}
                                                </td>
                                                <td>
                                                    <span className={`badge ${badge.class}`}>
                                                        {badge.icon}
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <button
                                                        onClick={() => handleViewDetails(item)}
                                                        className="btn-icon !min-w-[36px] !min-h-[36px] !h-9 !w-9 p-1 hover:border-lime"
                                                        title="View Details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add Write-Off Modal */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content relative max-w-lg w-full bg-[var(--bg-card)] p-6 rounded-2xl border animate-scaleIn" style={{ borderColor: 'var(--border-main)' }}>
                        <button
                            className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer bg-transparent border-none"
                            onClick={() => setShowAddModal(false)}
                            title="Close modal"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                            <ShieldAlert size={20} className="text-[var(--sidebar-active)]" />
                            Log Write-Off Request
                        </h2>

                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            {/* Part Search and Selection */}
                            <div className="space-y-1 relative">
                                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Search & Select Inventory Part *
                                </label>
                                {!selectedPart ? (
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                                        <input
                                            type="text"
                                            value={partSearch}
                                            onChange={(e) => setPartSearch(e.target.value)}
                                            placeholder="Type part name or part number..."
                                            className="input-field pl-10"
                                            required={!selectedPart}
                                        />
                                        {searchingParts && (
                                            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--sidebar-active)]" />
                                        )}

                                        {/* Dropdown Results */}
                                        {partResults.length > 0 && (
                                            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border bg-[var(--bg-card)] border-[var(--border-main)] shadow-xl z-[60]">
                                                {partResults.map((part) => (
                                                    <div
                                                        key={part._id}
                                                        onClick={() => {
                                                            setSelectedPart(part);
                                                            setQuantity(1);
                                                            setPartResults([]);
                                                            setPartSearch('');
                                                        }}
                                                        className="px-4 py-2 hover:bg-[var(--sidebar-hover)] cursor-pointer text-xs flex justify-between items-center"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-[var(--text-main)]">{part.partName}</div>
                                                            <div className="opacity-50 font-mono">{part.partNumber}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-semibold text-[var(--sidebar-active)]">Stock: {part.quantityOnHand} {part.unit}</div>
                                                            <div className="opacity-40 font-mono">${part.unitCost.toFixed(2)} / {part.unit}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-3.5 rounded-xl border bg-[var(--bg-input)] border-[var(--border-main)] flex items-center justify-between">
                                        <div>
                                            <div className="font-bold text-sm text-[var(--text-main)]">{selectedPart.partName}</div>
                                            <div className="text-xs font-mono opacity-50 uppercase mt-0.5">{selectedPart.partNumber}</div>
                                            <div className="text-[10px] uppercase font-bold tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Available Stock: {selectedPart.quantityOnHand} {selectedPart.unit}(s) | Cost: ${selectedPart.unitCost.toFixed(2)}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPart(null)}
                                            className="px-2.5 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/5 text-xs font-semibold"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedPart && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Quantity */}
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                                Quantity to Write Off *
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                max={selectedPart.quantityOnHand}
                                                value={quantity}
                                                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="input-field text-center font-bold"
                                            />
                                        </div>

                                        {/* Cost details */}
                                        <div className="p-3 rounded-xl border bg-red-500/5 border-red-500/10 flex flex-col justify-center">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Calculated Loss</span>
                                            <span className="text-lg font-black text-red-500 font-mono">${calculatedLoss.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                            Reason for Write Off *
                                        </label>
                                        <textarea
                                            required
                                            rows={2}
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Specify reason (e.g. Broken during service, water damage)..."
                                            className="input-field resize-none py-2"
                                        />
                                    </div>

                                    {/* Documents */}
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                            Document URL / Reference (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={docUrl}
                                            onChange={(e) => setDocUrl(e.target.value)}
                                            placeholder="https://example.com/photo.jpg"
                                            className="input-field"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold"
                                    onClick={() => setShowAddModal(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                                    disabled={submitting || !selectedPart}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Request'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {showDetailsModal && selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content relative max-w-lg w-full bg-[var(--bg-card)] p-6 rounded-2xl border animate-scaleIn" style={{ borderColor: 'var(--border-main)' }}>
                        <button
                            className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer bg-transparent border-none"
                            onClick={() => setShowDetailsModal(false)}
                            title="Close modal"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold mb-5 flex items-center gap-2 border-b pb-3" style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }}>
                            <ShieldAlert size={22} className="text-[var(--sidebar-active)]" />
                            Write-Off Log Details
                        </h2>

                        <div className="space-y-4">
                            {/* Grid Details */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Request ID</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{selectedItem.requestNumber || formatId(selectedItem._id)}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Status</span>
                                    <span className={`badge ${getStatusBadge(selectedItem.status).class} mt-0.5`}>
                                        {getStatusBadge(selectedItem.status).icon}
                                        {getStatusBadge(selectedItem.status).label}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Part Name</span>
                                    <span className="font-semibold text-[var(--text-main)]">{selectedItem.part?.partName || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Part Number</span>
                                    <span className="font-mono text-[var(--text-muted)]">{selectedItem.part?.partNumber || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Quantity Written-Off</span>
                                    <span className="font-semibold text-[var(--text-main)]">{selectedItem.quantity} {selectedItem.part?.unit || 'pc'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Unit Cost</span>
                                    <span className="font-mono text-[var(--text-muted)]">${selectedItem.unitCost?.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Total Loss Value</span>
                                    <span className="font-mono font-bold text-red-500">${selectedItem.amountLoss?.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Logged Date</span>
                                    <span className="text-[var(--text-muted)]">{new Date(selectedItem.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Reason block */}
                            <div className="text-sm bg-[var(--bg-input)] p-3 rounded-xl border border-[var(--border-main)]">
                                <span className="block text-xs uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Reason for Write Off</span>
                                <p className="text-xs" style={{ color: 'var(--text-main)' }}>{selectedItem.reason}</p>
                            </div>

                            {/* Optional documents */}
                            {selectedItem.documents && selectedItem.documents.length > 0 && (
                                <div className="text-sm p-3 rounded-xl border border-[var(--border-main)]">
                                    <span className="block text-xs uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Attached Reference</span>
                                    <a
                                        href={selectedItem.documents[0]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[var(--sidebar-active)] hover:underline flex items-center gap-1.5 mt-1 font-semibold"
                                    >
                                        <FileText size={14} />
                                        View Reference Document / Photo
                                    </a>
                                </div>
                            )}

                            {/* Rejection Note if Rejected */}
                            {selectedItem.status === 'REJECTED' && selectedItem.rejectionNote && (
                                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-1.5">
                                    <h3 className="text-sm font-bold flex items-center gap-1.5 text-red-500">
                                        <AlertCircle size={16} />
                                        Rejection Details
                                    </h3>
                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
                                        Note from Auditor: <span className="font-medium text-red-400">{selectedItem.rejectionNote}</span>
                                    </p>
                                </div>
                            )}

                            {/* Approval Note if Approved */}
                            {selectedItem.status === 'APPROVED' && selectedItem.approvalNote && (
                                <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5 space-y-1.5">
                                    <h3 className="text-sm font-bold flex items-center gap-1.5 text-green-500">
                                        <CheckCircle size={16} />
                                        Approval Details
                                    </h3>
                                    <p className="text-xs font-semibold" style={{ color: 'var(--text-main)' }}>
                                        Note: <span className="font-medium text-green-400">{selectedItem.approvalNote}</span>
                                    </p>
                                </div>
                            )}

                            {/* Actions Form */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-main)]">
                                <button
                                    type="button"
                                    className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold"
                                    onClick={() => setShowDetailsModal(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WriteOffList;
