import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClipboardList, Package, Check, ArrowRight, Loader2,
  Search, Filter, ExternalLink, AlertCircle, ShoppingCart, CheckCircle2, Shield
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  getLowStock, restockPart,
  type InventoryPart
} from '../services/inventoryService';
import { createProcurementRequest } from '../services/workshopProcurementService';
import { getUser, getUserRole, getBranchId } from '../utils/auth';
import { getApprovalThreshold, updateApprovalThreshold } from '../services/workOrderService';

const WorkshopRequirements = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = getUser();
  const branchId = getBranchId() || '';

  const [lowStockParts, setLowStockParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'low_stock' | 'settings'>((searchParams.get('tab') as any) || 'low_stock');
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedRestockPart, setSelectedRestockPart] = useState<{ id: string, name: string, unit?: string } | null>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [threshold, setThreshold] = useState<number>(200);
  const [saveLoading, setSaveLoading] = useState(false);
  const isManager = getUserRole() === 'workshopmanager';

  useEffect(() => {
    loadRequirements();
    if (isManager) {
      getApprovalThreshold().then(setThreshold);
    }
  }, [branchId]);

  const loadRequirements = async () => {
    setLoading(true);
    try {
      if (branchId) {
        const lowStockData = await getLowStock(branchId);
        setLowStockParts(lowStockData);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleRestockClick = (partId: string, partName: string, unit?: string) => {
    setSelectedRestockPart({ id: partId, name: partName, unit: unit || 'units' });
    setRestockQty(10); // default qty
    setShowRestockModal(true);
  };

  const confirmRestock = async () => {
    if (!selectedRestockPart || restockQty <= 0) return toast.error('Invalid quantity');

    setActionLoading(`restock-${selectedRestockPart.id}`);
    try {
      await createProcurementRequest({
        part: selectedRestockPart.id,
        quantity: restockQty,
        notes: `Restock request for ${selectedRestockPart.name} from Low Stock alert`
      });
      toast.success(`Purchase request for ${restockQty} units of ${selectedRestockPart.name} created successfully!`);
      setShowRestockModal(false);
      setSelectedRestockPart(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create purchase request');
    } finally {
      setActionLoading(null);
    }
  };


  const filteredLowStock = lowStockParts.filter(part =>
    part.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && lowStockParts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Workshop Requirements</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Pending parts and stock allocation for active repairs.</p>
      </div>

      {/* Toolbar & Tabs */}
      <div className="glass-card p-4 flex flex-col gap-4">

        {/* Tabs */}
        <div className="flex bg-[#00000066] p-1.5 rounded-xl border border-white/5 relative self-start mb-2">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-lg transition-all duration-300 ease-in-out shadow-lg"
            style={{
              left: activeTab === 'low_stock' 
                ? '6px' 
                : 'calc(50% + 3px)',
              width: isManager ? 'calc(50% - 9px)' : 'calc(100% - 12px)',
              background: 'var(--brand-lime)'
            }}
          />
          <button
            type="button"
            onClick={() => setActiveTab('low_stock')}
            className={`w-[160px] flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 ${activeTab === 'low_stock' ? 'text-black' : 'text-white/40 hover:text-white'
              }`}
          >
            Low Stock
            {lowStockParts.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'low_stock' ? 'bg-black text-[var(--brand-lime)]' : 'bg-red-500/20 text-red-400'}`}>
                {lowStockParts.length}
              </span>
            )}
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`w-[160px] flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 ${activeTab === 'settings' ? 'text-black' : 'text-white/40 hover:text-white'
                }`}
            >
              Settings
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              placeholder={activeTab === 'low_stock' ? "Search by Part Name or Number..." : "Search..."}
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-secondary whitespace-nowrap" onClick={loadRequirements}>
            <Loader2 size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* List Area */}
      <div className="space-y-4">

        {activeTab === 'low_stock' && (
          filteredLowStock.length === 0 ? (
            <div className="glass-card p-12 text-center opacity-40">
              <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium">Inventory looks healthy!</p>
              <p className="text-sm mt-1">There are no parts below their reorder levels right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLowStock.map(p => (
                <div key={p._id} className="glass-card p-4 flex items-center justify-between border-l-4 border-l-red-500/80">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{p.partName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono opacity-50 uppercase">{p.partNumber || 'NO_SERIAL'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] opacity-60 font-bold uppercase">
                          {p.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider mb-1">Stock Level</p>
                      <p className="text-xs font-mono font-bold">
                        <span className="text-red-400">{p.quantityOnHand - p.quantityReserved}</span>
                        <span className="opacity-40 ml-1">/ {p.reorderLevel} min</span>
                      </p>
                    </div>

                    <>
                      <div className="h-8 w-[1px] bg-white/10 mx-2" />
                      <button
                        className="btn-primary !py-2 !px-4 !text-xs !rounded-lg flex items-center gap-2 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white !border-transparent hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all"
                        onClick={() => handleRestockClick(p._id, p.partName, p.unit)}
                        disabled={actionLoading === `restock-${p._id}`}
                      >
                        {actionLoading === `restock-${p._id}` ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                        Create Request
                      </button>
                    </>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {activeTab === 'settings' && isManager && (
          <div className="glass-card p-8 space-y-8 animate-fadeInUp">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] flex items-center justify-center">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold">Workshop Approval Settings</h3>
                <p className="text-xs text-muted-foreground">Configure thresholds for automated vs manual work order approvals.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">
                    Auto-Approval Threshold ($)
                  </label>
                  <p className="text-xs text-muted-foreground mb-4 px-1">
                    Work orders with an estimated total cost below this value will be automatically approved (transition directly to START).
                  </p>
                  <div className="relative group">
                    <input
                      type="number"
                      className="input-field pl-12 text-lg font-mono"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-mono opacity-40">$</div>
                  </div>
                </div>

                <button
                  className="btn-primary w-full !py-4 shadow-[0_10px_20px_rgba(186,255,41,0.2)] hover:shadow-[0_15px_30px_rgba(186,255,41,0.3)]"
                  disabled={saveLoading}
                  onClick={async () => {
                    setSaveLoading(true);
                    try {
                      await updateApprovalThreshold(threshold);
                      toast.success('Approval threshold updated successfully');
                    } catch (err: any) {
                      toast.error('Failed to update settings');
                    } finally {
                      setSaveLoading(false);
                    }
                  }}
                >
                  {saveLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Save Configuration
                </button>
              </div>

              <div className="bg-white/5 rounded-3xl p-6 border border-white/5 flex flex-col justify-center">
                <h4 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-orange-400" /> Current Logic
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="opacity-60 text-green-400">0 - {threshold}</span>
                    <span className="font-bold">Auto-Approved</span>
                  </div>
                  <div className="flex justify-between text-xs p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="opacity-60 text-orange-400">{threshold} - 1000</span>
                    <span className="font-bold">Workshop Manager</span>
                  </div>
                  <div className="flex justify-between text-xs p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="opacity-60 text-blue-400">1000 - 5000</span>
                    <span className="font-bold">Country Manager</span>
                  </div>
                  <div className="flex justify-between text-xs p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="opacity-60 text-purple-400">&gt; 5000</span>
                    <span className="font-bold">Admin Level</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Restock/Purchase Request Modal */}
      {showRestockModal && selectedRestockPart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-sm p-6 space-y-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
              <ShoppingCart size={32} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Create Purchase Request</h2>
              <p className="text-sm opacity-60 mt-1">{selectedRestockPart.name}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Quantity Requested ({selectedRestockPart.unit})</label>
                <input
                  type="number"
                  min="1"
                  className="input-field text-center text-lg font-bold"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setShowRestockModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary flex-1 bg-blue-600 hover:bg-blue-700 !border-blue-600"
                  disabled={actionLoading === `restock-${selectedRestockPart.id}` || restockQty < 1}
                  onClick={confirmRestock}
                >
                  {actionLoading === `restock-${selectedRestockPart.id}` ? <Loader2 size={18} className="animate-spin" /> : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkshopRequirements;
