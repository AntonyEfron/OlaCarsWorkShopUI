import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Search, Clock,
  CheckCircle2, XCircle, Plus,
  Eye, Loader2, X, Package, Truck, Upload, AlertCircle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getProcurementRequests,
  createProcurementRequest,
  receiveProcurementRequest,
  type ProcurementRequest
} from '../services/workshopProcurementService';
import { getParts, type InventoryPart } from '../services/inventoryService';
import { getUserRole, getBranchId, getUser } from '../utils/auth';

const CATEGORIES = [
  'Engine', 'Electrical', 'Suspension', 'Lubricants', 'Consumables', 'Body', 'Tyres', 'Other'
];

const UOM_OPTIONS = ['PCS', 'SET', 'LTR', 'KG', 'BOX', 'CAN', 'MTR', 'PAIR', 'UNIT'];

const PurchaseRequests = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = getUserRole();
  const user = getUser();
  const branchId = getBranchId() || '';

  const [orders, setOrders] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [submitting, setSubmitting] = useState<string | null>(null);

  // New Request Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [parts, setParts] = useState<InventoryPart[]>([]);

  // Form State
  const [creationType, setCreationType] = useState<'PARTS_BASED' | 'VEHICLE_BASED'>('PARTS_BASED');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [technicianName, setTechnicianName] = useState((user?.fullName as string) || (user?.name as string) || '');
  const [isNewItem, setIsNewItem] = useState(false);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [category, setCategory] = useState('Engine');
  const [quantity, setQuantity] = useState(1);
  const [unitOfMeasure, setUnitOfMeasure] = useState('PCS');
  const [notes, setNotes] = useState('');

  // Vehicle Fields
  const [vin, setVin] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState(new Date().getFullYear().toString());
  const [plateNumber, setPlateNumber] = useState('');

  // Photo Files
  const [fullSizePhotoFile, setFullSizePhotoFile] = useState<File | null>(null);
  const [closeUpPhotoFile, setCloseUpPhotoFile] = useState<File | null>(null);
  const [fullSizePreview, setFullSizePreview] = useState<string>('');
  const [closeUpPreview, setCloseUpPreview] = useState<string>('');

  useEffect(() => {
    loadOrders();
  }, [branchId, statusFilter]);

  useEffect(() => {
    if (showNewModal) {
      loadFormData();
    }
  }, [showNewModal]);

  const loadFormData = async () => {
    try {
      const partsData = await getParts({ branchId });
      setParts(partsData);
    } catch (err) {
      console.error('Failed to load parts master', err);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await getProcurementRequests({
        branchId,
        limit: 1000,
        status: statusFilter === 'ALL' ? undefined : statusFilter
      });
      setOrders(response);
    } catch (err) {
      toast.error('Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  };

  const handlePartSelection = (partId: string) => {
    setSelectedPartId(partId);
    if (partId === 'NEW_ITEM') {
      setIsNewItem(true);
      setItemCode('');
      setPartNumber('');
      setPartName('');
      setUnitOfMeasure('PCS');
    } else {
      setIsNewItem(false);
      const found = parts.find(p => p._id === partId);
      if (found) {
        setItemCode(found.itemCode || found.partNumber || '');
        setPartNumber(found.partNumber || '');
        setPartName(found.partName || '');
        setCategory((found as any).category || 'Engine');
        setUnitOfMeasure((found as any).unit || 'PCS');
      }
    }
  };

  const handleFullSizePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFullSizePhotoFile(file);
      setFullSizePreview(URL.createObjectURL(file));
    }
  };

  const handleCloseUpPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCloseUpPhotoFile(file);
      setCloseUpPreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setCreationType('PARTS_BASED');
    setPriority('MEDIUM');
    setIsNewItem(false);
    setSelectedPartId('');
    setItemCode('');
    setPartNumber('');
    setPartName('');
    setCategory('Engine');
    setQuantity(1);
    setUnitOfMeasure('PCS');
    setNotes('');
    setVin('');
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear(new Date().getFullYear().toString());
    setPlateNumber('');
    setFullSizePhotoFile(null);
    setCloseUpPhotoFile(null);
    setFullSizePreview('');
    setCloseUpPreview('');
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNewItem && !selectedPartId) {
      toast.error('Please select an Item from Master or choose New Item');
      return;
    }
    if (isNewItem && !partName.trim()) {
      toast.error('Please provide a Part Name / Description for the new item');
      return;
    }

    setSubmitting('new');
    try {
      const formData = new FormData();
      formData.append('creationType', creationType);
      formData.append('priority', priority);
      formData.append('technicianName', technicianName);
      formData.append('isNewItem', String(isNewItem));
      if (!isNewItem && selectedPartId) formData.append('part', selectedPartId);
      formData.append('itemCode', itemCode);
      formData.append('partNumber', partNumber);
      formData.append('partName', partName);
      formData.append('category', category);
      formData.append('quantity', String(quantity));
      formData.append('unitOfMeasure', unitOfMeasure);
      formData.append('notes', notes);

      if (creationType === 'VEHICLE_BASED') {
        formData.append('vin', vin);
        formData.append('vehicleMake', vehicleMake);
        formData.append('vehicleModel', vehicleModel);
        formData.append('vehicleYear', vehicleYear);
        formData.append('plateNumber', plateNumber);
      }

      if (fullSizePhotoFile) formData.append('fullSizePhoto', fullSizePhotoFile);
      if (closeUpPhotoFile) formData.append('closeUpPhoto', closeUpPhotoFile);

      await createProcurementRequest(formData);
      toast.success('Purchase request created successfully!');
      setShowNewModal(false);
      resetForm();
      loadOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create purchase request');
    } finally {
      setSubmitting(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    const q = searchTerm.toLowerCase();
    return (
      (o.requestNumber || '').toLowerCase().includes(q) ||
      (o.partName || o.part?.partName || '').toLowerCase().includes(q) ||
      (o.partNumber || o.part?.partNumber || '').toLowerCase().includes(q) ||
      (o.technicianName || o.requestedBy?.fullName || '').toLowerCase().includes(q) ||
      (o.plateNumber || '').toLowerCase().includes(q) ||
      (o.vin || '').toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', label: 'PENDING APPROVAL' };
      case 'RETURNED_TO_TECHNICIAN': return { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: 'RETURNED TO TECH' };
      case 'APPROVED': return { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'APPROVED' };
      case 'PENDING_FINANCE_APPROVAL': return { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', label: 'PENDING FINANCE' };
      case 'COST_APPROVED': return { bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400', label: 'COST APPROVED' };
      case 'IN_TRANSIT': return { bg: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-400', label: 'IN TRANSIT' };
      case 'RECEIVED': return { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'RECEIVED' };
      case 'REJECTED': return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'REJECTED' };
      default: return { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-gray-400', label: status.replace(/_/g, ' ') };
    }
  };

  const now = new Date();
  const formattedMonth = String(now.getMonth() + 1).padStart(2, '0');
  const previewPRNumber = `PR-OW-${formattedMonth}-${now.getFullYear()}-XXXXX`;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <ShoppingCart className="text-[var(--brand-lime)]" size={26} />
            Purchase Requests (PR)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Create, track, and approve procurement requests for parts and vehicle repairs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOrders}
            disabled={loading}
            className="btn-secondary text-xs !py-2.5 !px-4 flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary text-xs !py-2.5 !px-4 font-bold flex items-center gap-2"
          >
            <Plus size={16} /> New Purchase Request
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by PR #, Item Code, Part Name, Tech, VIN, or Plate..."
            className="input-field pl-10 text-xs w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-field text-xs w-full md:w-52"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending Manager Approval</option>
          <option value="RETURNED_TO_TECHNICIAN">Returned to Technician</option>
          <option value="APPROVED">Approved / Waiting Quotation</option>
          <option value="PENDING_FINANCE_APPROVAL">Pending Finance</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="RECEIVED">Received</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-2xl border border-[var(--border-main)]/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-main)]/40 bg-black/20 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">PR Details</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Item & Category</th>
                <th className="py-3 px-4">Qty & UOM</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]/20">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-[var(--brand-lime)] mb-2" />
                    <p className="text-xs text-muted-foreground">Loading purchase requests...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center opacity-50">
                    <ShoppingCart size={40} className="mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-bold text-white mb-1">No Purchase Requests Found</p>
                    <p className="text-xs text-muted-foreground">Click "New Purchase Request" to create a new PR.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusStyle = getStatusBadge(order.status);
                  const pName = order.partName || order.part?.partName || 'Item';
                  const pNum = order.partNumber || order.part?.partNumber || '—';
                  return (
                    <tr key={order._id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-[var(--brand-lime)] text-xs block">
                          {order.requestNumber}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="badge badge-gray text-[9px] uppercase font-bold">
                            {order.creationType === 'VEHICLE_BASED' ? '🚘 Vehicle Based' : '📦 Parts Based'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          order.priority === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : order.priority === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}>
                          {order.priority || 'MEDIUM'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Package size={13} className="text-muted-foreground shrink-0" />
                          {pName}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          {pNum && <span>PN: <code className="text-white font-mono">{pNum}</code></span>}
                          {order.category && <span className="badge badge-gray text-[9px]">{order.category}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {order.quantity} <span className="text-[10px] text-muted-foreground font-semibold">{order.unitOfMeasure || 'PCS'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-muted-foreground">
                        <strong className="text-white block">{order.technicianName || order.requestedBy?.fullName || '—'}</strong>
                        <span className="text-[10px] opacity-75">{order.requestedByRole || ''}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/purchase-requests/${order._id}`)}
                          className="btn-secondary text-[11px] !py-1.5 !px-3 font-bold inline-flex items-center gap-1 hover:!bg-[var(--brand-lime)] hover:!text-black"
                        >
                          <Eye size={13} />
                          {role === 'workshopmanager' && order.status === 'PENDING' ? 'Review & Approve' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New PR Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="glass-card w-full max-w-2xl p-6 space-y-6 shadow-2xl border border-[var(--border-main)] my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-main)]/50 pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <ShoppingCart className="text-[var(--brand-lime)]" size={22} />
                  Create New Purchase Request
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>PR #: <strong className="text-[var(--brand-lime)] font-mono">{previewPRNumber}</strong></span>
                  <span>Date & Time: <strong className="text-white">{now.toLocaleString()}</strong></span>
                </div>
              </div>
              <button
                onClick={() => { setShowNewModal(false); resetForm(); }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-muted-foreground hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-5">
              {/* Type Selection Tabs */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-[var(--border-main)]/60">
                <button
                  type="button"
                  onClick={() => setCreationType('PARTS_BASED')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    creationType === 'PARTS_BASED'
                      ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  📦 Parts Based PR
                </button>
                <button
                  type="button"
                  onClick={() => setCreationType('VEHICLE_BASED')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    creationType === 'VEHICLE_BASED'
                      ? 'bg-[var(--brand-lime)] text-[var(--brand-black)] shadow-md'
                      : 'text-muted-foreground hover:text-white'
                  }`}
                >
                  🚘 Vehicle Based PR
                </button>
              </div>

              {/* Common Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Requested By / Technician Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter technician name"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="input-field w-full text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Priority Level *</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="input-field w-full text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              {/* Vehicle Fields (If Vehicle Based) */}
              {creationType === 'VEHICLE_BASED' && (
                <div className="glass-card p-4 border border-blue-500/30 bg-blue-500/5 space-y-3 rounded-xl">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Truck size={14} /> Vehicle Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">VIN / Chassis #</label>
                      <input
                        type="text"
                        placeholder="e.g., LZE123456789"
                        value={vin}
                        onChange={(e) => setVin(e.target.value)}
                        className="input-field w-full text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Make & Model</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          placeholder="Make"
                          value={vehicleMake}
                          onChange={(e) => setVehicleMake(e.target.value)}
                          className="input-field w-full text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Model"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          className="input-field w-full text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Plate Number</label>
                      <input
                        type="text"
                        placeholder="e.g., ABC-1234"
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        className="input-field w-full text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Part Details Section */}
              <div className="space-y-4 pt-1 border-t border-[var(--border-main)]/40">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Item Master Selection *</label>
                  <button
                    type="button"
                    onClick={() => handlePartSelection(isNewItem ? '' : 'NEW_ITEM')}
                    className="text-[11px] text-[var(--brand-lime)] hover:underline font-bold"
                  >
                    {isNewItem ? '← Select Existing Item from Master' : '+ Click if item code does not exist (New Item)'}
                  </button>
                </div>

                {!isNewItem ? (
                  <div className="space-y-1.5">
                    <select
                      className="input-field w-full text-xs"
                      value={selectedPartId}
                      onChange={(e) => handlePartSelection(e.target.value)}
                    >
                      <option value="">-- Select Item Code / Part from Master --</option>
                      {parts.map(p => (
                        <option key={p._id} value={p._id}>
                          {p.itemCode ? `[${p.itemCode}] ` : ''}{p.partName} ({p.partNumber || 'No PN'}) — Stock: {p.quantityOnHand} {p.unit || 'PCS'}
                        </option>
                      ))}
                      <option value="NEW_ITEM">+ New Item (Not in Master Data)</option>
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-amber-400" />
                    New Item Mode: Enter details manually for item creation.
                  </div>
                )}

                {/* Item Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Item Code</label>
                    <input
                      type="text"
                      placeholder="e.g., OWM0010"
                      value={itemCode}
                      onChange={(e) => setItemCode(e.target.value)}
                      disabled={!isNewItem && !!selectedPartId}
                      className="input-field w-full text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">OEM / Part Number</label>
                    <input
                      type="text"
                      placeholder="e.g., 1017001234"
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value)}
                      disabled={!isNewItem && !!selectedPartId}
                      className="input-field w-full text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Part Name / Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full part description"
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    disabled={!isNewItem && !!selectedPartId}
                    className="input-field w-full text-xs font-bold text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={!isNewItem && !!selectedPartId}
                      className="input-field w-full text-xs"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Quantity Requested *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="input-field w-full text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Unit of Measure (UOM) *</label>
                    {isNewItem ? (
                      <select
                        value={unitOfMeasure}
                        onChange={(e) => setUnitOfMeasure(e.target.value)}
                        className="input-field w-full text-xs font-bold"
                      >
                        {UOM_OPTIONS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        readOnly
                        value={unitOfMeasure}
                        className="input-field w-full text-xs font-bold bg-white/5 opacity-80"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Photo Upload Dropzones (2 mandatory fields) */}
              <div className="space-y-2 pt-2 border-t border-[var(--border-main)]/40">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attach 2 Photo Proofs</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Size Photo */}
                  <div className="border-2 border-dashed border-[var(--border-main)] rounded-xl p-3 text-center hover:border-[var(--brand-lime)] transition-colors">
                    <p className="text-[10px] font-bold uppercase text-white mb-2">1. Full Size Photo</p>
                    {fullSizePreview ? (
                      <div className="relative group">
                        <img src={fullSizePreview} alt="Full Size Preview" className="h-28 w-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => { setFullSizePhotoFile(null); setFullSizePreview(''); }}
                          className="absolute top-1 right-1 p-1 bg-black/80 rounded-full text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center py-4">
                        <Upload size={20} className="text-muted-foreground mb-1" />
                        <span className="text-[11px] text-[var(--brand-lime)] font-bold">Upload Full Size Photo</span>
                        <input type="file" accept="image/*" onChange={handleFullSizePhotoChange} className="hidden" />
                      </label>
                    )}
                  </div>

                  {/* Close-Up Photo */}
                  <div className="border-2 border-dashed border-[var(--border-main)] rounded-xl p-3 text-center hover:border-[var(--brand-lime)] transition-colors">
                    <p className="text-[10px] font-bold uppercase text-white mb-2">2. Close-Up Photo (Part # Visible)</p>
                    {closeUpPreview ? (
                      <div className="relative group">
                        <img src={closeUpPreview} alt="Close Up Preview" className="h-28 w-full object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => { setCloseUpPhotoFile(null); setCloseUpPreview(''); }}
                          className="absolute top-1 right-1 p-1 bg-black/80 rounded-full text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center justify-center py-4">
                        <Upload size={20} className="text-muted-foreground mb-1" />
                        <span className="text-[11px] text-[var(--brand-lime)] font-bold">Upload Close-Up Photo</span>
                        <input type="file" accept="image/*" onChange={handleCloseUpPhotoChange} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Additional Notes / Reason</label>
                <textarea
                  rows={2}
                  className="input-field w-full text-xs resize-none"
                  placeholder="Provide additional details or reason for request..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[var(--border-main)]/50">
                <button
                  type="button"
                  className="btn-secondary flex-1 text-xs"
                  onClick={() => { setShowNewModal(false); resetForm(); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 text-xs font-bold"
                  disabled={submitting === 'new'}
                >
                  {submitting === 'new' ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Submit Purchase Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRequests;
