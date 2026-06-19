import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, Search, Clock, CheckCircle2, XCircle,
  Eye, Loader2, Package, Truck, Receipt, Calendar, User, Landmark, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getPurchaseOrders, type PurchaseOrder } from '../services/purchaseOrderService';
import { getUserRole, getBranchId } from '../utils/auth';

const PurchaseOrders = () => {
  const { t } = useTranslation();
  const role = getUserRole();
  const branchId = getBranchId() || '';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    loadOrders();
  }, [branchId, statusFilter]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await getPurchaseOrders({
        branchId,
        status: statusFilter === 'ALL' ? undefined : statusFilter
      });
      setOrders(response);
    } catch (err) {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o =>
    (o.purchaseOrderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.items || []).some(item => (item.itemName || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'REQUESTED': return { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: <Clock size={12} /> };
      case 'MANAGER_APPROVED': return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', icon: <CheckCircle2 size={12} /> };
      case 'WAITING': return { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: <Clock size={12} /> };
      case 'APPROVED': return { bg: 'bg-green-500/10', text: 'text-green-500', icon: <CheckCircle2 size={12} /> };
      case 'RECEIVED': return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: <Package size={12} /> };
      case 'REJECTED': return { bg: 'bg-red-500/10', text: 'text-red-500', icon: <XCircle size={12} /> };
      default: return { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: <Clock size={12} /> };
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Purchase Orders</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track workshop purchase orders and fulfillment.</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4 flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            placeholder="Search by PO number or item name..."
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
          <option value="WAITING">Waiting</option>
          <option value="APPROVED">Approved</option>
          <option value="RECEIVED">Received</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">PO Number</th>
                <th>Supplier</th>
                <th>Items Count</th>
                <th>Total Amount</th>
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
                    <Receipt size={40} className="mx-auto mb-3" />
                    <p>No purchase orders found.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusStyle = getStatusStyle(order.status);
                  return (
                    <tr key={order._id} className="group hover:bg-white/[0.01] transition-colors border-b border-white/[0.03]">
                      <td className="pl-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-lime)]">{order.purchaseOrderNumber}</p>
                        <p className="text-[9px] opacity-40 mt-0.5">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="text-xs font-semibold">{order.supplier?.name || order.supplierDetails?.name || '—'}</td>
                      <td className="text-xs">{order.items?.length || 0} item(s)</td>
                      <td className="text-xs font-bold font-mono">${(order.totalAmount || 0).toFixed(2)}</td>
                      <td>
                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${statusStyle.bg} ${statusStyle.text}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="!pr-6 text-right">
                        <button
                          onClick={() => setSelectedPO(order)}
                          className="p-2 rounded-lg hover:bg-[var(--bg-input)] transition-colors"
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
      </div>

      {/* PO Detail Modal */}
      {selectedPO && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-2xl p-6 space-y-6 shadow-2xl max-h-[85vh] overflow-y-auto mt-8">
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-4">
              <div>
                <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest bg-zinc-800 text-zinc-400">
                  {selectedPO.purpose} PO
                </span>
                <h2 className="text-xl font-bold mt-1.5 font-mono text-[var(--brand-lime)]">{selectedPO.purchaseOrderNumber}</h2>
              </div>
              <button
                onClick={() => setSelectedPO(null)}
                className="p-2 hover:bg-[var(--bg-input)] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-lime)]">PO Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="opacity-60">Status:</span><span className="font-bold">{selectedPO.status}</span></div>
                  <div className="flex justify-between"><span className="opacity-60">Date Created:</span><span>{new Date(selectedPO.createdAt).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="opacity-60">Branch:</span><span>{selectedPO.branch?.name || '—'}</span></div>
                  {(selectedPO.supplier || selectedPO.supplierDetails) && (
                    <div className="flex justify-between">
                      <span className="opacity-60">Supplier:</span>
                      <span>{selectedPO.supplier?.name || selectedPO.supplierDetails?.name || '—'}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-lime)]">Creator Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="opacity-60">Created By Role:</span><span className="uppercase">{selectedPO.creatorRole}</span></div>
                  {selectedPO.approvedBy && (
                    <>
                      <div className="flex justify-between"><span className="opacity-60">Approved By Role:</span><span className="uppercase">{selectedPO.approverRole}</span></div>
                      {selectedPO.approvalNote && <div className="flex justify-between"><span className="opacity-60">Approval Note:</span><span className="italic">"{selectedPO.approvalNote}"</span></div>}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-lime)]">Items List</h3>
              <div className="border border-white/[0.05] rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.05]" style={{ color: 'var(--text-muted)' }}>
                      <th className="p-3 font-semibold">Item Name</th>
                      <th className="p-3 font-semibold">Quantity</th>
                      <th className="p-3 font-semibold text-right">Unit Price</th>
                      <th className="p-3 font-semibold text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedPO.items || []).map((item, idx) => (
                      <tr key={idx} className="border-b border-white/[0.03]">
                        <td className="p-3">
                          <p className="font-bold">{item.itemName}</p>
                          {item.description && <p className="text-[10px] opacity-60 mt-0.5">{item.description}</p>}
                        </td>
                        <td className="p-3 font-medium">{item.quantity}</td>
                        <td className="p-3 text-right font-mono">${(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-bold">${((item.quantity || 1) * (item.unitPrice || 0)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end pr-3">
                <p className="text-sm font-bold">Total Amount: <span className="font-mono text-[var(--brand-lime)] ml-1">${(selectedPO.totalAmount || 0).toFixed(2)}</span></p>
              </div>
            </div>

            {selectedPO.editHistory && selectedPO.editHistory.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-lime)]">History Logs</h3>
                <div className="space-y-2">
                  {selectedPO.editHistory.map((log: any, idx) => (
                    <div key={idx} className="flex gap-3 text-xs bg-white/[0.01] p-3 rounded-lg border border-white/[0.03]">
                      <div className="flex-shrink-0 text-white/[0.3] mt-0.5">
                        <Clock size={14} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-zinc-300">Status transition: <span className="text-[10px] font-black uppercase bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{log.previousStatus}</span></p>
                          <p className="text-[10px] opacity-40">{new Date(log.editedAt).toLocaleString()}</p>
                        </div>
                        <p className="text-zinc-400 mt-1">{log.changesSummary}</p>
                        <p className="text-[10px] opacity-40 mt-1">By Role: {log.editorRole}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
