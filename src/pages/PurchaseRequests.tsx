import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Search, Filter, Clock,
  CheckCircle2, XCircle, ChevronDown, Plus,
  Eye, Loader2, Check, X, Package, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getProcurementRequests,
  approveProcurementRequest,
  createProcurementRequest,
  receiveProcurementRequest,
  type ProcurementRequest
} from '../services/workshopProcurementService';
import { getParts, type InventoryPart } from '../services/inventoryService';
import { getUserRole, getBranchId } from '../utils/auth';

const PurchaseRequests = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = getUserRole();
  const branchId = getBranchId() || '';
  const isManager = role === 'workshopmanager';

  const [orders, setOrders] = useState<ProcurementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [submitting, setSubmitting] = useState<string | null>(null);

  // New Request Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [newRequestForm, setNewRequestForm] = useState({
    partId: '',
    quantity: 1,
    unitPrice: 0,
    description: ''
  });

  // Approval state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(0);

  useEffect(() => {
    loadOrders();
    if (showNewModal) {
      loadFormData();
    }
  }, [branchId, statusFilter, showNewModal]);

  const loadFormData = async () => {
    try {
      const partsData = await getParts({ branchId });
      setParts(partsData);
    } catch (err) {
      toast.error('Failed to load parts');
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
      console.log("[DEBUG] loadOrders response:", response);
      setOrders(response);
    } catch (err) {
      toast.error('Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, status: 'PENDING_FINANCE_APPROVAL' | 'REJECTED') => {
    setSubmitting(id);
    try {
      await approveProcurementRequest(id, {
        status,
        quantity: status === 'PENDING_FINANCE_APPROVAL' ? selectedQuantity : undefined
      });
      toast.success(status === 'PENDING_FINANCE_APPROVAL' ? 'Request approved and sent to Finance' : 'Request rejected');
      setApprovingId(null);
      setSelectedQuantity(0);
      loadOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(null);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestForm.partId) {
      toast.error('Please select a part');
      return;
    }

    const selectedPart = parts.find(p => p._id === newRequestForm.partId);
    if (!selectedPart) return;

    setSubmitting('new');
    try {
      await createProcurementRequest({
        part: newRequestForm.partId,
        quantity: newRequestForm.quantity,
        notes: newRequestForm.description || `Manual purchase request for: ${selectedPart.partName}`
      });
      toast.success('Purchase request created successfully');
      setShowNewModal(false);
      setNewRequestForm({ partId: '', quantity: 1, unitPrice: 0, description: '' });
      loadOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create request');
    } finally {
      setSubmitting(null);
    }
  };

  const filteredOrders = orders.filter(o =>
    (o.requestNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.part?.partName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PENDING': return { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: <Clock size={12} /> };
      case 'PENDING_FINANCE_APPROVAL': return { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: <Clock size={12} /> };
      case 'APPROVED': return { bg: 'bg-green-500/10', text: 'text-green-500', icon: <CheckCircle2 size={12} /> };
      case 'COST_APPROVED': return { bg: 'bg-teal-500/10', text: 'text-teal-400', icon: <CheckCircle2 size={12} /> };
      case 'IN_TRANSIT': return { bg: 'bg-sky-500/10', text: 'text-sky-400', icon: <Truck size={12} /> };
      case 'RECEIVED': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <CheckCircle2 size={12} /> };
      case 'REJECTED': return { bg: 'bg-red-500/10', text: 'text-red-500', icon: <XCircle size={12} /> };
      default: return { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: <Clock size={12} /> };
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Purchase Requests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track and manage part procurement requests.</p>
        </div>
        {role === 'workshopstaff' && (
          <button
            onClick={() => setShowNewModal(true)}
            className="btn-primary"
          >
            <Plus size={18} /> New Request
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            placeholder="Search by request number or item name..."
            className="input-field pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-field w-40"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PENDING_FINANCE_APPROVAL">Pending Finance</option>
          <option value="APPROVED">Approved</option>
          <option value="COST_APPROVED">Cost Approved</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="RECEIVED">Received</option>
          <option value="REJECTED">Rejected</option>
          <option value="CONVERTED_TO_PO">Converted to PO</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">ID</th>
                <th>Part</th>
                <th>Quantity</th>
                <th>Requested By</th>
                <th>Status</th>
                <th className="pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-[var(--brand-lime)]" />
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center opacity-40">
                    <ShoppingCart size={40} className="mx-auto mb-3" />
                    <p>No procurement requests found.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order._id} className="group hover:bg-white/[0.01] transition-colors border-b border-white/[0.03]">
                    <td className="pl-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-lime)]">{order.requestNumber}</p>
                      <p className="text-[9px] opacity-40 mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-input)] flex items-center justify-center">
                          <Package size={14} className="opacity-40" />
                        </div>
                        <div>
                          <p className="text-xs font-bold">{order.part?.partName || 'Unknown Part'}</p>
                          <p className="text-[10px] opacity-40 font-mono">{order.part?.partNumber || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs font-bold">{order.quantity} {order.part?.unit || ''}</td>
                    <td className="text-xs">{order.requestedBy?.fullName || '—'}</td>
                    <td>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${order.status === 'APPROVED' ? 'bg-green-500/10 text-green-500' :
                          order.status === 'COST_APPROVED' ? 'bg-teal-500/10 text-teal-400' :
                            order.status === 'IN_TRANSIT' ? 'bg-sky-500/10 text-sky-400' :
                              order.status === 'RECEIVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                order.status === 'PENDING_FINANCE_APPROVAL' ? 'bg-orange-500/10 text-orange-500' :
                                  order.status === 'PENDING' ? 'bg-blue-500/10 text-blue-500' :
                                    order.status === 'REJECTED' ? 'bg-red-500/10 text-red-500' :
                                      'bg-gray-500/10 text-gray-500'
                        }`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="!pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isManager && order.status === 'PENDING' && (
                          <>
                            {approvingId === order._id ? (
                              <div className="flex items-center gap-2 animate-fadeIn">
                                <input
                                  type="number"
                                  min="1"
                                  className="input-field !py-1.5 !px-2 text-[10px] w-16"
                                  value={selectedQuantity}
                                  onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                                  title="Edit Quantity"
                                />
                                <button
                                  onClick={() => handleAction(order._id, 'PENDING_FINANCE_APPROVAL')}
                                  className="p-2 rounded-lg bg-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-all"
                                  disabled={submitting === order._id}
                                >
                                  {submitting === order._id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                </button>
                                <button
                                  onClick={() => setApprovingId(null)}
                                  className="p-2 rounded-lg bg-gray-500/20 text-gray-500 hover:bg-gray-500 hover:text-white transition-all"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setApprovingId(order._id);
                                    setSelectedQuantity(order.quantity);
                                    loadFormData();
                                  }}
                                  className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all"
                                  title="Approve"
                                  disabled={submitting === order._id}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => handleAction(order._id, 'REJECTED')}
                                  className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                  title="Reject"
                                  disabled={submitting === order._id}
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {order.status === 'IN_TRANSIT' && (
                          <button
                            onClick={async () => {
                              setSubmitting(order._id);
                              try {
                                await receiveProcurementRequest(order._id);
                                toast.success('Package marked as received!');
                                loadOrders();
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || 'Failed to receive');
                              } finally {
                                setSubmitting(null);
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                            disabled={submitting === order._id}
                          >
                            {submitting === order._id ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                            Receive
                          </button>
                        )}
                        {order.status === 'RECEIVED' && !order.inventoryAdded && (
                          <button
                            onClick={() => navigate(`/purchase-requests/${order._id}`)}
                            className="px-3 py-1.5 rounded-lg bg-[var(--brand-lime)]/10 text-[var(--brand-lime)] hover:bg-[var(--brand-lime)] hover:text-black transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                          >
                            <Plus size={12} />
                            Add to Inventory
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/purchase-requests/${order._id}`)}
                          className="p-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 space-y-6 shadow-2xl mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">New Purchase Request</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 hover:bg-[var(--bg-input)] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Part from Inventory</label>
                <select
                  required
                  className="input-field"
                  value={newRequestForm.partId}
                  onChange={(e) => {
                    const part = parts.find(p => p._id === e.target.value);
                    setNewRequestForm({
                      ...newRequestForm,
                      partId: e.target.value,
                      unitPrice: part?.unitCost || 0
                    });
                  }}
                >
                  <option value="">Select a part...</option>
                  {parts.map(p => (
                    <option key={p._id} value={p._id}>{p.partName} ({p.partNumber}) - Stock: {p.quantityOnHand}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="input-field"
                    value={newRequestForm.quantity}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Est. Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input-field"
                    value={newRequestForm.unitPrice}
                    onChange={(e) => setNewRequestForm({ ...newRequestForm, unitPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Reason / Notes (Optional)</label>
                <textarea
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Why is this part needed?"
                  value={newRequestForm.description}
                  onChange={(e) => setNewRequestForm({ ...newRequestForm, description: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={submitting === 'new'}
                >
                  {submitting === 'new' ? <Loader2 size={18} className="animate-spin" /> : 'Create Request'}
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
