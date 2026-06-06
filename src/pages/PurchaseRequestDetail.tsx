import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, Clock, CheckCircle2, XCircle, Truck, AlertTriangle,
  Loader2, FileText, User, Calendar, Landmark, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getProcurementRequestById,
  addInventoryProcurementRequest,
  receiveProcurementRequest,
  type ProcurementRequest
} from '../services/workshopProcurementService';

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; text: string; icon: JSX.Element }> = {
    PENDING: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: <Clock size={14} /> },
    PENDING_FINANCE_APPROVAL: { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: <Clock size={14} /> },
    APPROVED: { bg: 'bg-green-500/10', text: 'text-green-500', icon: <CheckCircle2 size={14} /> },
    COST_APPROVED: { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: <CheckCircle2 size={14} /> },
    IN_TRANSIT: { bg: 'bg-sky-500/10', text: 'text-sky-400', icon: <Truck size={14} /> },
    RECEIVED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <Package size={14} /> },
    REJECTED: { bg: 'bg-red-500/10', text: 'text-red-500', icon: <XCircle size={14} /> },
    CONVERTED_TO_PO: { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: <Receipt size={14} /> },
  };
  const s = styles[status] || styles.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${s.bg} ${s.text}`}>
      {s.icon} {status.replace(/_/g, ' ')}
    </span>
  );
};

const PurchaseRequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<ProcurementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [receivedQuantity, setReceivedQuantity] = useState<number>(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getProcurementRequestById(id);
      setRequest(data);
      if (data.receivedQuantity !== undefined && data.receivedQuantity !== null) {
        setReceivedQuantity(data.receivedQuantity);
      } else {
        setReceivedQuantity(data.quantity || 0);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleReceive = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await receiveProcurementRequest(request._id);
      toast.success('Package marked as received!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to receive');
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
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--brand-lime)' }} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-20 space-y-4">
        <AlertTriangle size={48} className="mx-auto opacity-30" />
        <p style={{ color: 'var(--text-muted)' }}>Purchase request not found.</p>
        <button onClick={() => navigate('/purchase-requests')} className="btn-secondary text-xs">
          <ArrowLeft size={14} /> Back to List
        </button>
      </div>
    );
  }

  const requestedQty = request.quantity || 0;
  const unitPrice = request.merchandiserPrice || request.part?.unitCost || 0;
  const deficitQty = Math.max(0, requestedQty - receivedQuantity);
  const deficitAmt = deficitQty * unitPrice;
  const isReceived = request.status === 'RECEIVED';
  const canAddInventory = isReceived && !request.inventoryAdded;

  return (
    <div className="space-y-6 animate-fadeInUp max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <button className="btn-icon flex-shrink-0" onClick={() => navigate('/purchase-requests')}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>
              {request.requestNumber}
            </h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Purchase Request Details
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Part Details */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-lime)' }}>
            <Package size={14} /> Part Information
          </div>
          <div className="space-y-3">
            <InfoRow label="Part Name" value={request.part?.partName || '—'} />
            <InfoRow label="Part Number" value={request.part?.partNumber || '—'} />
            <InfoRow label="Unit" value={request.part?.unit || '—'} />
            <InfoRow label="Unit Cost (Catalog)" value={`$${(request.part?.unitCost || 0).toFixed(2)}`} />
            {request.merchandiserPrice && (
              <InfoRow label="Audited Unit Price" value={`$${request.merchandiserPrice.toFixed(2)}`} highlight />
            )}
            {request.merchandiserTotalAmount && (
              <InfoRow label="Audited Total" value={`$${request.merchandiserTotalAmount.toFixed(2)}`} highlight />
            )}
          </div>
        </div>

        {/* Request Details */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-lime)' }}>
            <FileText size={14} /> Request Details
          </div>
          <div className="space-y-3">
            <InfoRow label="Requested Quantity" value={`${requestedQty}`} />
            <InfoRow label="Requested By" value={request.requestedBy?.fullName || '—'} />
            <InfoRow label="Date" value={new Date(request.createdAt).toLocaleDateString()} />
            {request.supplier && <InfoRow label="Supplier" value={request.supplier.name} />}
            {request.notes && <InfoRow label="Notes" value={request.notes} />}
          </div>
        </div>
      </div>

      {/* Status-Specific Action: IN_TRANSIT -> Receive */}
      {request.status === 'IN_TRANSIT' && (
        <div className="glass-card p-6 border-sky-500/20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
              <Truck size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Package In Transit</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Click below when the package arrives at the workshop.</p>
            </div>
          </div>
          <button
            onClick={handleReceive}
            disabled={actionLoading}
            className="btn-primary w-full text-sm !py-3 flex items-center justify-center gap-2"
          >
            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
            Mark as Received
          </button>
        </div>
      )}

      {/* Status-Specific Action: RECEIVED + Add Inventory */}
      {canAddInventory && (
        <div className="glass-card p-6 space-y-5" style={{ borderColor: 'var(--brand-lime)', borderWidth: '1px' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'var(--brand-lime-alpha, rgba(200,230,0,0.1))', color: 'var(--brand-lime)' }}>
              <Package size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Add to Inventory</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Enter the actual quantity received in the package. Any deficit will be calculated automatically.
              </p>
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
              Quantity Received in Package
            </label>
            <input
              type="number"
              min="0"
              max={requestedQty * 2}
              value={receivedQuantity}
              onChange={(e) => setReceivedQuantity(Number(e.target.value))}
              className="input-field w-full text-lg font-bold"
              placeholder="Enter received quantity..."
            />
          </div>

          {/* Live Calculations */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Requested</p>
              <p className="text-xl font-bold font-mono" style={{ color: 'var(--text-main)' }}>{requestedQty}</p>
            </div>
            <div className="glass-card p-4 text-center" style={{ borderColor: 'var(--brand-lime)', borderWidth: '1px' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Received</p>
              <p className="text-xl font-bold font-mono" style={{ color: 'var(--brand-lime)' }}>{receivedQuantity}</p>
            </div>
            <div className={`glass-card p-4 text-center ${deficitQty > 0 ? 'border-red-500/30' : 'border-green-500/30'}`} style={{ borderWidth: '1px' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Deficit</p>
              <p className={`text-xl font-bold font-mono ${deficitQty > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {deficitQty}
              </p>
            </div>
          </div>

          {deficitQty > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-semibold">
              <AlertTriangle size={14} />
              Deficit of {deficitQty} unit(s) — estimated loss: ${deficitAmt.toFixed(2)}
            </div>
          )}

          <button
            onClick={handleAddInventory}
            disabled={actionLoading}
            className="btn-primary w-full text-sm !py-3 flex items-center justify-center gap-2"
          >
            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Confirm & Update Inventory
          </button>
        </div>
      )}

      {/* Already Added - Show Receipt Summary */}
      {request.inventoryAdded && (
        <div className="glass-card p-6 space-y-4 border-green-500/20" style={{ borderWidth: '1px' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Inventory Updated</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This purchase request has been processed and stock levels updated.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="glass-card p-4 text-center">
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Requested</p>
              <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-main)' }}>{requestedQty}</p>
            </div>
            <div className="glass-card p-4 text-center border-green-500/20" style={{ borderWidth: '1px' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Received</p>
              <p className="text-lg font-bold font-mono text-green-400">{request.receivedQuantity ?? 0}</p>
            </div>
            <div className={`glass-card p-4 text-center ${(request.deficitQuantity ?? 0) > 0 ? 'border-red-500/20' : 'border-green-500/20'}`} style={{ borderWidth: '1px' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Deficit Qty</p>
              <p className={`text-lg font-bold font-mono ${(request.deficitQuantity ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {request.deficitQuantity ?? 0}
              </p>
            </div>
            <div className={`glass-card p-4 text-center ${(request.deficitAmount ?? 0) > 0 ? 'border-red-500/20' : 'border-green-500/20'}`} style={{ borderWidth: '1px' }}>
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Deficit Amount</p>
              <p className={`text-lg font-bold font-mono ${(request.deficitAmount ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                ${(request.deficitAmount ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex justify-between items-start gap-4">
    <span className="text-[10px] uppercase tracking-wider font-semibold flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span className={`text-xs text-right font-medium ${highlight ? 'font-bold' : ''}`} style={{ color: highlight ? 'var(--brand-lime)' : 'var(--text-main)' }}>{value}</span>
  </div>
);

export default PurchaseRequestDetail;
