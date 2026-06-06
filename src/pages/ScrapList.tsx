import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Search,
    Filter,
    Trash2,
    Calendar,
    User,
    Recycle,
    CheckCircle,
    AlertCircle,
    ChevronDown,
    PlusCircle,
    X,
    Loader2,
    Eye,
    ArrowUpDown,
    Coins,
} from 'lucide-react';
import { getScrapItems, createScrapItem, updateScrapItem, type ScrapItem } from '../services/scrapService';

const ScrapList = () => {
    const { t } = useTranslation();
    const [scrapItems, setScrapItems] = useState<ScrapItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [sortByValuable, setSortByValuable] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Modal state for Add
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        partName: '',
        partNumber: '',
        quantity: 1,
        description: '',
        status: 'PENDING_DISPOSAL' as ScrapItem['status'],
        type: 'Non Valuable' as ScrapItem['type'],
        buyerName: '',
        currentAmount: '',
    });

    // Modal state for Details
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ScrapItem | null>(null);
    const [saleAmount, setSaleAmount] = useState('');
    const [buyerName, setBuyerName] = useState('');
    const [updatingSale, setUpdatingSale] = useState(false);

    useEffect(() => {
        loadScrapItems();
    }, [statusFilter, typeFilter, searchTerm]);

    const loadScrapItems = async () => {
        setLoading(true);
        try {
            const data = await getScrapItems({
                status: statusFilter,
                type: typeFilter,
                search: searchTerm,
            });
            setScrapItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load scrap items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createScrapItem({
                partName: formData.partName,
                partNumber: formData.partNumber || undefined,
                quantity: Number(formData.quantity),
                description: formData.description || undefined,
                status: formData.type === 'Valuable' ? 'PENDING_SALE_APPROVAL' : formData.status,
                type: formData.type,
                buyerName: formData.type === 'Valuable' ? formData.buyerName : undefined,
                currentAmount: formData.type === 'Valuable' ? Number(formData.currentAmount) : undefined,
            });

            // Reset form and close modal
            setFormData({
                partName: '',
                partNumber: '',
                quantity: 1,
                description: '',
                status: 'PENDING_DISPOSAL',
                type: 'Non Valuable',
                buyerName: '',
                currentAmount: '',
            });
            setShowAddModal(false);
            // Reload list
            loadScrapItems();
        } catch (error) {
            console.error('Failed to create scrap item:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewDetails = (item: ScrapItem) => {
        setSelectedItem(item);
        setSaleAmount(item.currentAmount ? String(item.currentAmount) : '');
        setBuyerName(item.buyerName || '');
        setShowDetailsModal(true);
    };

    const handleSaleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItem) return;
        setUpdatingSale(true);
        try {
            const updated = await updateScrapItem(selectedItem._id, {
                currentAmount: Number(saleAmount),
                buyerName: buyerName,
                status: 'PENDING_SALE_APPROVAL', // Send to financial admin for approval
            });
            setShowDetailsModal(false);
            loadScrapItems();
        } catch (error) {
            console.error('Failed to update scrap sale info:', error);
        } finally {
            setUpdatingSale(false);
        }
    };

    // Stats calculations
    const totalScrappedParts = scrapItems.reduce((sum, item) => sum + item.quantity, 0);
    const pendingDisposalCount = scrapItems
        .filter((item) => item.status === 'PENDING_DISPOSAL')
        .reduce((sum, item) => sum + item.quantity, 0);
    const disposedRecycledCount = scrapItems
        .filter((item) => item.status === 'DISPOSED' || item.status === 'RECYCLED')
        .reduce((sum, item) => sum + item.quantity, 0);

    // Apply sorting logic
    const sortedItems = [...scrapItems].sort((a, b) => {
        if (sortByValuable) {
            if (a.type === 'Valuable' && b.type !== 'Valuable') return -1;
            if (a.type !== 'Valuable' && b.type === 'Valuable') return 1;
        }
        return new Date(b.scrappedDate || b.createdAt).getTime() - new Date(a.scrappedDate || a.createdAt).getTime();
    });

    const getStatusBadge = (status: ScrapItem['status']) => {
        switch (status) {
            case 'REJECTED':
                return {
                    class: 'badge-red',
                    label: 'Sale Rejected',
                    icon: <AlertCircle size={12} className="mr-1 inline" />,
                };
            case 'PENDING_DISPOSAL':
                return {
                    class: 'badge-blue',
                    label: 'Pending Disposal',
                    icon: <AlertCircle size={12} className="mr-1 inline" />,
                };
            case 'PENDING_SALE_APPROVAL':
                return {
                    class: 'badge-orange',
                    label: 'Pending Sale Approval',
                    icon: <AlertCircle size={12} className="mr-1 inline" />,
                };
            case 'DISPOSED':
                return {
                    class: 'badge-gray',
                    label: 'Disposed',
                    icon: <CheckCircle size={12} className="mr-1 inline" />,
                };
            case 'RECYCLED':
                return {
                    class: 'badge-green',
                    label: 'Recycled',
                    icon: <Recycle size={12} className="mr-1 inline" />,
                };
            default:
                return {
                    class: 'badge-gray',
                    label: status,
                    icon: null,
                };
        }
    };

    const getTypeBadge = (type: ScrapItem['type']) => {
        if (type === 'Valuable') {
            return 'badge-lime';
        }
        return 'badge-blue';
    };

    const formatId = (id: string) => {
        if (!id) return '';
        if (id.startsWith('SCRAP-')) return id;
        return `SCRAP-${id.substring(id.length - 6).toUpperCase()}`;
    };

    return (
        <div className="space-y-6 animate-fadeInUp">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                        <Trash2 size={24} className="text-[var(--sidebar-active)]" />
                        Scrap Management
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Track and manage decommissioned workshop parts, replacements, and disposal statuses.
                    </p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => setShowAddModal(true)}
                    id="add-scrap-part-btn"
                >
                    <PlusCircle size={18} />
                    Add Scrap Part
                </button>
            </div>

            {/* Statistics Widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card">
                    <span className="stat-label">Total Scrapped Parts</span>
                    <span className="stat-value text-gradient-lime">{totalScrappedParts}</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Cumulative volume of decommissioned items</p>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Awaiting Disposal</span>
                    <span className="stat-value" style={{ color: 'var(--warn-orange)' }}>{pendingDisposalCount}</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Currently held in scrap inventory storage</p>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Disposed & Recycled</span>
                    <span className="stat-value" style={{ color: 'var(--text-main)' }}>{disposedRecycledCount}</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Safely processed, recycled or cleared</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-dim)' }} />
                        <input
                            type="text"
                            placeholder="Search by Part Name, Part Number, ID, or Staff..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10"
                            id="scrap-search"
                        />
                    </div>
                    {/* Sort Toggle Button */}
                    <button
                        className={`btn-secondary ${sortByValuable ? '!border-lime !text-lime' : ''}`}
                        onClick={() => setSortByValuable(!sortByValuable)}
                        title="Sort Valuable items to the top"
                        style={sortByValuable ? { borderColor: 'var(--sidebar-active)', color: 'var(--sidebar-active)' } : {}}
                    >
                        <ArrowUpDown size={16} />
                        <span className="hidden sm:inline">Sort: Valuable</span>
                    </button>
                    <button
                        className={`btn-secondary ${showFilters ? '!border-lime !text-lime' : ''}`}
                        onClick={() => setShowFilters(!showFilters)}
                        style={showFilters ? { borderColor: 'var(--sidebar-active)', color: 'var(--sidebar-active)' } : {}}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">Filters</span>
                        <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t" style={{ borderColor: 'var(--border-main)' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field"
                            id="filter-scrap-status"
                        >
                            <option value="">All Statuses</option>
                            <option value="PENDING_DISPOSAL">Pending Disposal</option>
                            <option value="DISPOSED">Disposed</option>
                            <option value="RECYCLED">Recycled</option>
                        </select>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="input-field"
                            id="filter-scrap-type"
                        >
                            <option value="">All Types</option>
                            <option value="Valuable">Valuable</option>
                            <option value="Non Valuable">Non Valuable</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="glass-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--sidebar-active)' }} />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Scrap ID</th>
                                    <th>Part Details</th>
                                    <th>Type</th>
                                    <th className="text-center">Qty</th>
                                    <th>Reason / Description</th>
                                    <th>Scrapped By</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-10" style={{ color: 'var(--text-dim)' }}>
                                            <Trash2 size={40} className="mx-auto mb-2 opacity-20" />
                                            No scrap records found matching the criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedItems.map((item) => {
                                        const badge = getStatusBadge(item.status);
                                        return (
                                            <tr key={item._id}>
                                                <td className="font-mono text-xs font-bold" style={{ color: 'var(--sidebar-active)' }}>
                                                    {formatId(item._id)}
                                                </td>
                                                <td>
                                                    <div className="font-semibold" style={{ color: 'var(--text-main)' }}>
                                                        {item.partName}
                                                    </div>
                                                    {item.partNumber && (
                                                        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                                                            {item.partNumber}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${getTypeBadge(item.type)}`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="text-center font-semibold font-mono" style={{ color: 'var(--text-main)' }}>
                                                    {item.quantity}
                                                </td>
                                                <td className="max-w-xs truncate text-xs" title={item.description} style={{ color: 'var(--text-muted)' }}>
                                                    {item.description || 'No description provided'}
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                                                        <User size={14} />
                                                        {item.scrappedBy}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-dim)' }}>
                                                        <Calendar size={14} />
                                                        {new Date(item.scrappedDate || item.createdAt).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${badge.class}`}>
                                                        {badge.icon}
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    {item.type === 'Valuable' && (
                                                        <button
                                                            onClick={() => handleViewDetails(item)}
                                                            className="btn-icon !min-w-[36px] !min-h-[36px] !h-9 !w-9 p-1 hover:border-lime"
                                                            title="View Details"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                    )}
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

            {/* Add Scrap Modal Form */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content relative max-w-md w-full bg-[var(--bg-card)] p-6 rounded-2xl border animate-scaleIn" style={{ borderColor: 'var(--border-main)' }}>
                        {/* Close button */}
                        <button
                            className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer bg-transparent border-none"
                            onClick={() => setShowAddModal(false)}
                            title="Close modal"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                            <Trash2 size={20} className="text-[var(--sidebar-active)]" />
                            Log Scrap Item
                        </h2>

                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            {/* Part Name */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Part Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.partName}
                                    onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                                    placeholder="e.g. Front Brake Pads, Alternator"
                                    className="input-field"
                                />
                            </div>

                            {/* Part Number */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Part Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.partNumber}
                                    onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                                    placeholder="e.g. PN-129-XYZ"
                                    className="input-field"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* Quantity */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                        Quantity *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                        className="input-field"
                                    />
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                        Type *
                                    </label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value as ScrapItem['type'] })}
                                        className="input-field"
                                    >
                                        <option value="Non Valuable">Non Valuable</option>
                                        <option value="Valuable">Valuable</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* Suggested Buyer and Price if Valuable */}
                            {formData.type === 'Valuable' && (
                                <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                            Suggested Buyer Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.buyerName}
                                            onChange={(e) => setFormData({ ...formData, buyerName: e.target.value })}
                                            placeholder="e.g. RecycleCorp"
                                            className="input-field"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                            Suggested Sale Price ($) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            value={formData.currentAmount}
                                            onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                                            placeholder="e.g. 150.00"
                                            className="input-field"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Status */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Status *
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ScrapItem['status'] })}
                                    className="input-field"
                                >
                                    <option value="PENDING_DISPOSAL">Pending Disposal</option>
                                    <option value="DISPOSED">Disposed</option>
                                    <option value="RECYCLED">Recycled</option>
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                    Description / Reason *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the condition or reason for scrapping..."
                                    className="input-field resize-none py-2"
                                />
                            </div>

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
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Save Scrap'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Valuable Scrap Details Modal */}
            {showDetailsModal && selectedItem && (
                <div className="modal-overlay">
                    <div className="modal-content relative max-w-lg w-full bg-[var(--bg-card)] p-6 rounded-2xl border animate-scaleIn" style={{ borderColor: 'var(--border-main)' }}>
                        {/* Close button */}
                        <button
                            className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text-main)] cursor-pointer bg-transparent border-none"
                            onClick={() => setShowDetailsModal(false)}
                            title="Close modal"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold mb-5 flex items-center gap-2 border-b pb-3" style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)' }}>
                            <Coins size={22} className="text-[var(--sidebar-active)]" />
                            Valuable Scrap Details
                        </h2>

                        <div className="space-y-4">
                            {/* Grid Details */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Scrap ID</span>
                                    <span className="font-mono font-bold text-[var(--text-main)]">{formatId(selectedItem._id)}</span>
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
                                    <span className="font-semibold text-[var(--text-main)]">{selectedItem.partName}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Part Number</span>
                                    <span className="font-mono text-[var(--text-muted)]">{selectedItem.partNumber || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Quantity</span>
                                    <span className="font-semibold text-[var(--text-main)]">{selectedItem.quantity}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Scrapped By</span>
                                    <span className="text-[var(--text-muted)]">{selectedItem.scrappedBy}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Logged Date</span>
                                    <span className="text-[var(--text-muted)]">{new Date(selectedItem.scrappedDate || selectedItem.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div>
                                    <span className="block text-xs uppercase tracking-wider font-semibold text-[var(--text-dim)]">Item Type</span>
                                    <span className="badge badge-lime mt-0.5">{selectedItem.type}</span>
                                </div>
                            </div>

                            {/* Rejection Note alert block */}
                            {selectedItem.status === 'REJECTED' && selectedItem.rejectionNote && (
                                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-1.5 animate-fadeIn">
                                    <h3 className="text-sm font-bold flex items-center gap-1.5 text-red-500">
                                        <AlertCircle size={16} />
                                        Sale Rejection Details
                                    </h3>
                                    <p className="text-xs font-semibold text-[var(--text-main)]">
                                        Reason: <span className="font-medium text-red-400">{selectedItem.rejectionNote}</span>
                                    </p>
                                </div>
                            )}

                            {/* Description block */}
                            <div className="text-sm bg-[var(--bg-input)] p-3 rounded-xl border" style={{ borderColor: 'var(--border-main)' }}>
                                <span className="block text-xs uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Description / Scrap Reason</span>
                                <p className="text-xs" style={{ color: 'var(--text-main)' }}>{selectedItem.description || 'No description provided'}</p>
                            </div>

                            {/* Sale details / Submission Form */}
                            {selectedItem.status !== 'REJECTED' && (selectedItem.buyerName || selectedItem.currentAmount) ? (
                                <div className="p-4 rounded-xl border border-lime/20 bg-lime/5 space-y-2">
                                    <h3 className="text-sm font-bold flex items-center gap-1.5 text-[var(--sidebar-active)]">
                                        <CheckCircle size={16} />
                                        Sale Information Logs
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[var(--text-dim)] block">Buyer Name:</span>
                                            <strong className="text-[var(--text-main)]">{selectedItem.buyerName || 'N/A'}</strong>
                                        </div>
                                        <div>
                                            <span className="text-[var(--text-dim)] block">Current Sale Amount:</span>
                                            <strong className="text-[var(--text-main)]">${selectedItem.currentAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSaleSubmit} className="border-t pt-4 mt-2 space-y-4" style={{ borderColor: 'var(--border-main)' }}>
                                    <h3 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                                        {selectedItem.status === 'REJECTED' ? 'Resubmit Sale / Transaction' : 'Record Sale / Transaction'}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                                Buyer Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Scrap Metals Inc."
                                                value={buyerName}
                                                onChange={(e) => setBuyerName(e.target.value)}
                                                className="input-field"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                                                Current Amount ($) *
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="0.01"
                                                step="0.01"
                                                placeholder="e.g. 150.00"
                                                value={saleAmount}
                                                onChange={(e) => setSaleAmount(e.target.value)}
                                                className="input-field"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-3 pt-1">
                                        <button
                                            type="button"
                                            className="btn-secondary px-5 py-2 rounded-xl text-sm"
                                            onClick={() => setShowDetailsModal(false)}
                                            disabled={updatingSale}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-1.5"
                                            disabled={updatingSale}
                                        >
                                            {updatingSale ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                'Submit Sale Info'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScrapList;
