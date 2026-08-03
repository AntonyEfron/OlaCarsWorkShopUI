import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, Clock, CheckCircle2, XCircle, Truck, AlertTriangle,
  Loader2, User, Calendar, ShieldCheck, Image as ImageIcon, RotateCcw,
  Send, AlertCircle, ExternalLink, Edit3, Save, CheckSquare, Layers, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getProcurementRequestById,
  approveProcurementRequest,
  resubmitProcurementRequest,
  receiveProcurementRequest,
  addInventoryProcurementRequest,
  type ProcurementRequest
} from '../services/workshopProcurementService';
import { getUserRole, getUser } from '../utils/auth';

const CATEGORIES = [
  'Engine', 'Electrical', 'Suspension', 'Lubricants', 'Consumables', 'Body', 'Tyres', 'Other'
];

const UOM_OPTIONS = ['PCS', 'SET', 'LTR', 'KG', 'BOX', 'CAN', 'MTR', 'PAIR', 'UNIT'];

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    PENDING: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', icon: <Clock size={14} />, label: 'PENDING MANAGER APPROVAL' },
    RETURNED_TO_TECHNICIAN: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', icon: <RotateCcw size={14} />, label: 'RETURNED TO TECHNICIAN' },
    APPROVED: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: <CheckCircle2 size={14} />, label: 'APPROVED / WAITING QUOTATION' },
    PENDING_FINANCE_APPROVAL: { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', icon: <Clock size={14} />, label: 'PENDING FINANCE APPROVAL' },
    COST_APPROVED: { bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400', icon: <CheckCircle2 size={14} />, label: 'COST APPROVED' },
    IN_TRANSIT: { bg: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-400', icon: <Truck size={14} />, label: 'IN TRANSIT' },
    RECEIVED: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: <Package size={14} />, label: 'RECEIVED' },
    REJECTED: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', icon: <XCircle size={14} />, label: 'REJECTED' },
  };
  const s = styles[status] || styles.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${s.bg} ${s.text}`}>
      {s.icon} {s.label}
    </span>
  );
};

const PurchaseRequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = getUserRole();
  const user = getUser();
  const isManager = role === 'workshopmanager' || role === 'branchmanager' || role === 'admin';

  const [request, setRequest] = useState<ProcurementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Editable Manager / Tech Fields
  const [quantity, setQuantity] = useState<number>(1);
  const [itemCode, setItemCode] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partName, setPartName] = useState('');
  const [category, setCategory] = useState('Engine');
  const [unitOfMeasure, setUnitOfMeasure] = useState('PCS');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [vin, setVin] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Sourcing & Logistics Options (Manager)
  const [preferredSupplierName, setPreferredSupplierName] = useState('');
  const [preferredBrand, setPreferredBrand] = useState('');
  const [qualityPreference, setQualityPreference] = useState<'GENUINE_OEM' | 'AFTERMARKET_ANY_BRAND'>('GENUINE_OEM');
  const [transportationMode, setTransportationMode] = useState<'SEA' | 'AIR' | 'LAND'>('SEA');
  const [isInformationVerified, setIsInformationVerified] = useState(true);

  // Modals & Photos
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Receiving state
  const [receivedQuantity, setReceivedQuantity] = useState<number>(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getProcurementRequestById(id);
      setRequest(data);
      setQuantity(data.quantity || 1);
      setItemCode(data.itemCode || data.part?.itemCode || '');
      setPartNumber(data.partNumber || data.part?.partNumber || '');
      setPartName(data.partName || data.part?.partName || '');
      setCategory(data.category || (data.part as any)?.category || 'Engine');
      setUnitOfMeasure(data.unitOfMeasure || data.part?.unit || 'PCS');
      setPriority(data.priority || 'MEDIUM');
      setVin(data.vin || '');
      setVehicleMake(data.vehicleMake || '');
      setVehicleModel(data.vehicleModel || '');
      setVehicleYear(data.vehicleYear || '');
      setPlateNumber(data.plateNumber || '');
      setNotes(data.notes || '');

      // Sourcing
      setPreferredSupplierName(data.preferredSupplierName || data.supplier?.name || '');
      setPreferredBrand(data.preferredBrand || '');
      setQualityPreference(data.qualityPreference || 'GENUINE_OEM');
      setTransportationMode(data.transportationMode || 'SEA');
      setIsInformationVerified(data.isInformationVerified ?? true);

      if (data.receivedQuantity !== undefined && data.receivedQuantity !== null) {
        setReceivedQuantity(data.receivedQuantity);
      } else {
        setReceivedQuantity(data.quantity || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load purchase request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleManagerApprove = async () => {
    if (!request) return;
    if (!isInformationVerified) {
      toast.error('Please check "Provided Information is Verified as Accurate" before approving.');
      return;
    }
    setActionLoading(true);
    try {
      await approveProcurementRequest(request._id, {
        status: 'APPROVED',
        quantity,
        itemCode,
        partNumber,
        partName,
        category,
        unitOfMeasure,
        priority,
        vin,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        plateNumber,
        preferredSupplierName,
        preferredBrand,
        qualityPreference,
        transportationMode,
        isInformationVerified: true,
        notes
      });
      toast.success('Purchase Request APPROVED and passed to quotation stage!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManagerReturn = async () => {
    if (!request || !returnReason.trim()) {
      toast.error('Please enter a reason for returning the PR to technician');
      return;
    }
    setActionLoading(true);
    try {
      await approveProcurementRequest(request._id, {
        status: 'RETURNED_TO_TECHNICIAN',
        returnReason
      });
      toast.success('PR returned to technician for corrections');
      setShowReturnModal(false);
      setReturnReason('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Return action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManagerReject = async () => {
    if (!request || !rejectionReason.trim()) {
      toast.error('Please enter a reason for rejecting the PR');
      return;
    }
    setActionLoading(true);
    try {
      await approveProcurementRequest(request._id, {
        status: 'REJECTED',
        rejectionReason
      });
      toast.success('Purchase Request REJECTED');
      setShowRejectModal(false);
      setRejectionReason('');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTechResubmit = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await resubmitProcurementRequest(request._id, {
        quantity,
        itemCode,
        partNumber,
        partName,
        category,
        unitOfMeasure,
        priority,
        vin,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        plateNumber,
        notes
      });
      toast.success('Purchase Request resubmitted to Workshop Manager!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Resubmit failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await receiveProcurementRequest(request._id);
      toast.success('Package marked as received!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to receive package');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInventory = async () => {
    if (!request) return;
    if (receivedQuantity < 0) {
      toast.error('Received quantity cannot be negative.');
      return;
    }
    setActionLoading(true);
    try {
      await addInventoryProcurementRequest(request._id, { receivedQuantity });
      toast.success('Inventory updated successfully!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update inventory');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertTriangle size={48} className="mx-auto opacity-30 text-amber-400" />
        <p className="text-muted-foreground">Purchase request not found.</p>
        <button onClick={() => navigate('/purchase-requests')} className="btn-secondary text-xs">
          <ArrowLeft size={14} /> Back to List
        </button>
      </div>
    );
  }

  const isPending = request.status === 'PENDING';
  const isReturned = request.status === 'RETURNED_TO_TECHNICIAN';
  const isApproved = request.status === 'APPROVED' || request.status === 'WAITING_QUOTATION';
  const canEdit = (isPending && isManager) || (isReturned && !isManager);

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <button className="btn-icon shrink-0 mt-1" onClick={() => navigate('/purchase-requests')}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold font-mono text-[var(--brand-lime)]">
                {request.requestNumber}
              </h1>
              <StatusBadge status={request.status} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Created on <strong className="text-white">{new Date(request.createdAt).toLocaleString()}</strong> by <strong className="text-white">{request.technicianName || request.requestedBy?.fullName || 'Technician'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isReturned && (
            <div className="badge badge-amber text-xs flex items-center gap-1.5 px-3 py-1">
              <RotateCcw size={12} /> Returned to Technician for Correction
            </div>
          )}
        </div>
      </div>

      {/* Return Notice Banner (If returned) */}
      {isReturned && (
        <div className="glass-card p-4 border border-amber-500/40 bg-amber-500/10 rounded-2xl flex items-start gap-3 text-amber-300 animate-fadeIn">
          <AlertCircle size={22} className="shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Action Required: Purchase Request Returned</h4>
            <p className="text-xs">
              <strong>Manager Notes:</strong> {request.returnReason || 'Please review and update the details requested.'}
            </p>
          </div>
        </div>
      )}

      {/* Rejection Banner */}
      {request.status === 'REJECTED' && (
        <div className="glass-card p-4 border border-red-500/40 bg-red-500/10 rounded-2xl flex items-start gap-3 text-red-300 animate-fadeIn">
          <XCircle size={22} className="shrink-0 text-red-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-white">Purchase Request Cancelled / Rejected</h4>
            <p className="text-xs mt-1">
              <strong>Reason:</strong> {request.rejectionReason || 'Request was rejected by Workshop Manager.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form / Info Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* PR Details Card */}
          <div className="glass-card p-6 space-y-5 rounded-2xl border border-[var(--border-main)]/60">
            <div className="flex items-center justify-between border-b border-[var(--border-main)]/40 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-[var(--brand-lime)] flex items-center gap-2">
                <Package size={16} /> Item & Request Specification
              </h3>
              <span className={`badge text-[10px] uppercase font-bold ${
                request.priority === 'HIGH' ? 'bg-red-500/20 text-red-400'
                : request.priority === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400'
                : 'bg-gray-500/20 text-gray-400'
              }`}>
                {request.priority || 'MEDIUM'} Priority
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Technician Name</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={request.technicianName || request.requestedBy?.fullName || ''}
                  className="input-field w-full text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">PR Type</label>
                <input
                  type="text"
                  disabled
                  value={request.creationType === 'VEHICLE_BASED' ? '🚘 Vehicle Based PR' : '📦 Parts Based PR'}
                  className="input-field w-full text-xs font-bold opacity-80"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Item Code</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="input-field w-full text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">OEM / Part Number</label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="input-field w-full text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Part Name / Description</label>
              <input
                type="text"
                disabled={!canEdit}
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                className="input-field w-full text-xs font-bold text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Category</label>
                <select
                  disabled={!canEdit}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field w-full text-xs"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Quantity Requested</label>
                <input
                  type="number"
                  min="1"
                  disabled={!canEdit}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="input-field w-full text-xs font-bold text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Unit of Measure (UOM)</label>
                <select
                  disabled={!canEdit}
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  className="input-field w-full text-xs font-bold"
                >
                  {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* Vehicle details if available */}
            {(request.creationType === 'VEHICLE_BASED' || vin || plateNumber) && (
              <div className="glass-card p-4 border border-blue-500/30 bg-blue-500/5 space-y-3 rounded-xl">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck size={14} /> Linked Vehicle Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">VIN / Chassis Number</span>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={vin}
                      onChange={(e) => setVin(e.target.value)}
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Make / Model / Year</span>
                    <div className="flex gap-1 mt-1">
                      <input
                        type="text"
                        disabled={!canEdit}
                        placeholder="Make"
                        value={vehicleMake}
                        onChange={(e) => setVehicleMake(e.target.value)}
                        className="input-field w-full text-xs"
                      />
                      <input
                        type="text"
                        disabled={!canEdit}
                        placeholder="Model"
                        value={vehicleModel}
                        onChange={(e) => setVehicleModel(e.target.value)}
                        className="input-field w-full text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Plate Number</span>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={plateNumber}
                      onChange={(e) => setPlateNumber(e.target.value)}
                      className="input-field w-full text-xs font-bold text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Attached Photographs */}
            <div className="space-y-3 border-t border-[var(--border-main)]/40 pt-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={14} className="text-[var(--brand-lime)]" /> Photo Proofs
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-3 text-center border border-[var(--border-main)]/50 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Full Size Photo</span>
                  {request.fullSizePhoto ? (
                    <img
                      src={request.fullSizePhoto}
                      alt="Full Size"
                      onClick={() => setSelectedPhoto(request.fullSizePhoto!)}
                      className="h-36 w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="h-36 flex items-center justify-center text-xs text-muted-foreground bg-black/20 rounded-lg">
                      No full size photo uploaded
                    </div>
                  )}
                </div>

                <div className="glass-card p-3 text-center border border-[var(--border-main)]/50 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2">Close-Up Photo (Part #)</span>
                  {request.closeUpPhoto ? (
                    <img
                      src={request.closeUpPhoto}
                      alt="Close Up"
                      onClick={() => setSelectedPhoto(request.closeUpPhoto!)}
                      className="h-36 w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ) : (
                    <div className="h-36 flex items-center justify-center text-xs text-muted-foreground bg-black/20 rounded-lg">
                      No close-up photo uploaded
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Technician Resubmit Section */}
          {isReturned && !isManager && (
            <div className="glass-card p-6 border border-amber-500/40 bg-amber-500/5 space-y-4 rounded-2xl">
              <h3 className="text-sm font-black uppercase text-amber-300 flex items-center gap-2">
                <RotateCcw size={16} /> Update Details & Resubmit to Manager
              </h3>
              <p className="text-xs text-muted-foreground">
                Modify any incorrect details above and click below to resubmit this PR for Workshop Manager approval.
              </p>
              <button
                disabled={actionLoading}
                onClick={handleTechResubmit}
                className="btn-primary w-full text-xs font-bold !py-3 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Resubmit Purchase Request to Workshop Manager
              </button>
            </div>
          )}

          {/* Sourcing & Logistics Options (Workshop Manager Approval Form) */}
          {isManager && isPending && (
            <div className="glass-card p-6 border border-[var(--brand-lime)]/40 space-y-5 rounded-2xl bg-black/40 shadow-xl">
              <div className="border-b border-[var(--border-main)]/50 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-[var(--brand-lime)] flex items-center gap-2">
                  <ShieldCheck size={18} /> Workshop Manager Approval & Sourcing Options
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify request details, configure sourcing/logistics preferences, and approve or return the PR.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preferred Supplier / Vendor</label>
                  <input
                    type="text"
                    placeholder="Enter preferred vendor name"
                    value={preferredSupplierName}
                    onChange={(e) => setPreferredSupplierName(e.target.value)}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preferred Brand (If Any)</label>
                  <input
                    type="text"
                    placeholder="e.g., Bosch, Denso, Mobis"
                    value={preferredBrand}
                    onChange={(e) => setPreferredBrand(e.target.value)}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quality Preference *</label>
                  <select
                    value={qualityPreference}
                    onChange={(e) => setQualityPreference(e.target.value as any)}
                    className="input-field w-full text-xs font-bold"
                  >
                    <option value="GENUINE_OEM">Genuine / OEM Part (Original Equipment Manufacturer)</option>
                    <option value="AFTERMARKET_ANY_BRAND">Aftermarket / Any Brand</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transportation Mode *</label>
                  <select
                    value={transportationMode}
                    onChange={(e) => setTransportationMode(e.target.value as any)}
                    className="input-field w-full text-xs font-bold"
                  >
                    <option value="SEA">🚢 SEA Cargo</option>
                    <option value="AIR">✈️ AIR Freight</option>
                    <option value="LAND">🚚 LAND Transport</option>
                  </select>
                </div>
              </div>

              {/* Verification Checkbox */}
              <div className="p-4 bg-white/5 rounded-xl border border-[var(--border-main)]/50 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isInformationVerified}
                    onChange={(e) => setIsInformationVerified(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-[var(--brand-lime)] focus:ring-0"
                  />
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckSquare size={14} className="text-[var(--brand-lime)]" />
                    Provided Information is Verified as Accurate
                  </span>
                </label>
              </div>

              {/* Manager Actions: Approve, Return, Reject */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  disabled={actionLoading}
                  onClick={handleManagerApprove}
                  className="btn-primary text-xs !py-3 font-bold flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  APPROVE PR
                </button>

                <button
                  disabled={actionLoading}
                  onClick={() => setShowReturnModal(true)}
                  className="btn-secondary !text-amber-400 text-xs !py-3 font-bold flex items-center justify-center gap-1.5 hover:!bg-amber-500/20"
                >
                  <RotateCcw size={16} />
                  RETURN TO TECH
                </button>

                <button
                  disabled={actionLoading}
                  onClick={() => setShowRejectModal(true)}
                  className="btn-secondary !text-red-400 text-xs !py-3 font-bold flex items-center justify-center gap-1.5 hover:!bg-red-500/20"
                >
                  <XCircle size={16} />
                  REJECT PR
                </button>
              </div>
            </div>
          )}

          {/* Receiving & Inventory Actions (Post Approval) */}
          {request.status === 'IN_TRANSIT' && (
            <div className="glass-card p-6 border border-sky-500/40 bg-sky-500/10 space-y-4 rounded-2xl">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <Truck size={18} /> Package Shipped & In Transit
              </h3>
              <p className="text-xs text-muted-foreground">
                The requested item has been dispatched. Click below when the physical package arrives at the workshop.
              </p>
              <button
                disabled={actionLoading}
                onClick={handleReceive}
                className="btn-primary text-xs !py-3 font-bold flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                Confirm Package Arrival (Mark as Received)
              </button>
            </div>
          )}

          {request.status === 'RECEIVED' && !request.inventoryAdded && (
            <div className="glass-card p-6 border border-emerald-500/40 bg-emerald-500/10 space-y-4 rounded-2xl">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 size={18} /> Package Received — Update Inventory Stock
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Received Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={receivedQuantity}
                    onChange={(e) => setReceivedQuantity(Number(e.target.value))}
                    className="input-field w-full text-xs font-bold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    disabled={actionLoading}
                    onClick={handleAddInventory}
                    className="btn-primary w-full text-xs !py-2.5 font-bold flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                    Add Stock to Inventory
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Audit History & Summary */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="glass-card p-5 space-y-3 rounded-2xl border border-[var(--border-main)]/60">
            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <Layers size={14} /> Request Summary
            </h4>
            <div className="space-y-2 text-xs divide-y divide-[var(--border-main)]/20">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">PR Number</span>
                <span className="font-mono font-bold text-[var(--brand-lime)]">{request.requestNumber}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Status</span>
                <span className="font-bold text-white">{request.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Requested By</span>
                <span className="font-bold text-white">{request.technicianName || request.requestedBy?.fullName || 'Technician'}</span>
              </div>
              {request.approvedBy && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Approved By</span>
                  <span className="font-bold text-emerald-400">{request.approvedBy.fullName || request.approvedBy.name || 'Manager'}</span>
                </div>
              )}
              {request.transportationMode && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Transport Mode</span>
                  <span className="font-bold text-sky-400">{request.transportationMode}</span>
                </div>
              )}
              {request.qualityPreference && (
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Quality Preference</span>
                  <span className="font-bold text-amber-300">{request.qualityPreference === 'GENUINE_OEM' ? 'Genuine / OEM' : 'Aftermarket'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Audit History Timeline */}
          <div className="glass-card p-5 space-y-4 rounded-2xl border border-[var(--border-main)]/60">
            <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-[var(--brand-lime)]" /> PR History & Audit Log
            </h4>
            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-main)]/40">
              {(request.editHistory || []).length === 0 ? (
                <p className="text-xs text-muted-foreground pl-7">No history records yet.</p>
              ) : (
                request.editHistory!.map((hist, idx) => (
                  <div key={idx} className="relative pl-7 text-xs space-y-1">
                    <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-[var(--brand-lime)] border-2 border-black" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>{new Date(hist.editedAt).toLocaleString()}</span>
                      <span className="badge badge-gray text-[9px] uppercase">{hist.action || hist.editorRole || 'EDITED'}</span>
                    </div>
                    <p className="font-bold text-white">{hist.editorName || 'User'}</p>
                    <p className="text-[11px] text-muted-foreground">{hist.changesSummary}</p>
                    {hist.notes && (
                      <p className="text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mt-1">
                        "{hist.notes}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 space-y-4 rounded-2xl border border-amber-500/40">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
              <RotateCcw size={20} /> Return PR to Technician
            </div>
            <p className="text-xs text-muted-foreground">
              Please enter detailed feedback explaining what needs correction by the technician.
            </p>
            <textarea
              rows={3}
              required
              placeholder="e.g., Please attach a clearer close-up photo of the part number..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="input-field w-full text-xs"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowReturnModal(false); setReturnReason(''); }}
                className="btn-secondary flex-1 text-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleManagerReturn}
                className="btn-primary flex-1 text-xs !bg-amber-600 hover:!bg-amber-500 font-bold"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card max-w-md w-full p-6 space-y-4 rounded-2xl border border-red-500/40">
            <div className="flex items-center gap-2 text-red-400 font-bold text-base">
              <XCircle size={20} /> Reject / Cancel Purchase Request
            </div>
            <p className="text-xs text-muted-foreground">
              Rejecting this PR will cancel it permanently. Please enter a reason.
            </p>
            <textarea
              rows={3}
              required
              placeholder="Enter reason for rejecting this purchase request..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="input-field w-full text-xs"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="btn-secondary flex-1 text-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleManagerReject}
                className="btn-primary flex-1 text-xs !bg-red-600 hover:!bg-red-500 font-bold"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedPhoto} alt="Enlarged" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-2 right-2 p-2 bg-black/80 rounded-full text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRequestDetail;
