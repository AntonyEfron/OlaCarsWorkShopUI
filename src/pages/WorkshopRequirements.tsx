import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ClipboardList, Package, Check, ArrowRight, Loader2, 
  Search, Filter, ExternalLink, AlertCircle, ShoppingCart, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  getWorkshopRequirements, reserveStock, installPart, getLowStock, restockPart,
  type WorkshopRequirement, type InventoryPart 
} from '../services/inventoryService';
import { getUser, getUserRole } from '../utils/auth';

const WorkshopRequirements = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = getUser();
  const branchId = (user?.branchId as string) || '';

  const [requirements, setRequirements] = useState<WorkshopRequirement[]>([]);
  const [lowStockParts, setLowStockParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requirements' | 'low_stock'>('requirements');
  const isManager = getUserRole() === 'workshopmanager';

  useEffect(() => {
    loadRequirements();
  }, [branchId]);

  const loadRequirements = async () => {
    setLoading(true);
    try {
      if (branchId) {
        const [reqData, lowStockData] = await Promise.all([
          getWorkshopRequirements(branchId),
          getLowStock(branchId)
        ]);
        setRequirements(reqData);
        setLowStockParts(lowStockData);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (partId: string, requirementId: string, qty: number) => {
    setActionLoading(`${requirementId}-${partId}-reserve`);
    try {
      await reserveStock(partId, qty);
      toast.success('Stock reserved successfully');
      loadRequirements();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Reservation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleInstall = async (partId: string, requirementId: string, qty: number) => {
    setActionLoading(`${requirementId}-${partId}-install`);
    try {
      await installPart(partId, qty);
      toast.success('Part marked as installed');
      loadRequirements();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Installation record failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestock = async (partId: string, partName: string) => {
    const qtyStr = window.prompt(`Enter quantity to restock for ${partName}:`, '10');
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return toast.error('Invalid quantity');

    setActionLoading(`restock-${partId}`);
    try {
      await restockPart(partId, qty);
      toast.success(`${qty} units of ${partName} restocked successfully!`);
      loadRequirements();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Restock failed');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRequirements = requirements.filter(req => 
    req.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.vehicleLabel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLowStock = lowStockParts.filter(part =>
    part.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    part.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && requirements.length === 0) {
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
                className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-lg transition-all duration-300 ease-in-out shadow-lg"
                style={{ 
                    left: activeTab === 'requirements' ? '6px' : 'calc(50%)',
                    background: 'var(--brand-lime)'
                }}
            />
            <button
                type="button"
                onClick={() => setActiveTab('requirements')}
                className={`w-[160px] flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 ${
                    activeTab === 'requirements' ? 'text-black' : 'text-white/40 hover:text-white'
                }`}
            >
                Work Orders
            </button>
            <button
                type="button"
                onClick={() => setActiveTab('low_stock')}
                className={`w-[160px] flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 ${
                    activeTab === 'low_stock' ? 'text-black' : 'text-white/40 hover:text-white'
                }`}
            >
                Low Stock
                {lowStockParts.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'low_stock' ? 'bg-black text-[var(--brand-lime)]' : 'bg-red-500/20 text-red-400'}`}>
                    {lowStockParts.length}
                  </span>
                )}
            </button>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input 
              type="text" 
              placeholder={activeTab === 'requirements' ? "Search by Work Order # or Vehicle..." : "Search by Part Name or Number..."}
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
        {activeTab === 'requirements' && (
          filteredRequirements.length === 0 ? (
            <div className="glass-card p-12 text-center opacity-40">
              <ClipboardList size={48} className="mx-auto mb-4" />
              <p className="text-lg font-medium">Clear! No pending part requirements.</p>
              <p className="text-sm mt-1">New parts will appear here when added to active work orders.</p>
            </div>
          ) : (
            filteredRequirements.map(req => (
              <div key={req._id} className="glass-card overflow-hidden border-l-4 border-l-[var(--brand-lime)]">
                {/* WO Header */}
                <div className="px-5 py-4 bg-white/[0.02] flex items-center justify-between border-b" style={{ borderColor: 'var(--border-main)' }}>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--brand-lime)]">{req.workOrderNumber}</p>
                      <p className="text-sm font-bold truncate max-w-[200px]">{req.vehicleLabel}</p>
                    </div>
                    <div className="h-8 w-[1px] bg-white/10" />
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-40">Status</p>
                      <p className="text-xs font-semibold uppercase">{req.status.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/work-orders/${req._id}`)}
                    className="p-2 rounded-xl bg-[var(--bg-input)] hover:bg-[var(--brand-lime-alpha)] hover:text-[var(--brand-lime)] transition-all flex items-center gap-2 text-xs font-bold"
                  >
                    View Details <ExternalLink size={14} />
                  </button>
                </div>

                {/* Parts List */}
                <div className="divide-y" style={{ borderColor: 'var(--border-main)' }}>
                  {req.parts.map((part, idx) => (
                    <div key={`${req._id}-part-${idx}`} className="px-5 py-4 flex items-center justify-between group hover:bg-white/[0.01] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          part.status === 'INSTALLED' ? 'bg-green-500/10 text-green-500' : 
                          part.status === 'RESERVED' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'
                        }`}>
                          {part.status === 'INSTALLED' ? <Check size={20} /> : <Package size={20} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{part.partName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono opacity-50 uppercase">{part.partNumber || 'NO_SERIAL'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-input)] font-bold opacity-60">Qty: {part.quantity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${
                          part.status === 'INSTALLED' ? 'bg-green-500/10 text-green-500' : 
                          part.status === 'RESERVED' ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'
                        }`}>
                          {part.status}
                        </span>

                        <div className="h-8 w-[1px] bg-white/10 mx-2" />

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {part.status === 'REQUESTED' && part.inventoryPartId && (
                            <button 
                              className="btn-primary !py-1.5 !px-3 !text-xs !rounded-lg flex items-center gap-2 bg-blue-600 hover:bg-blue-700 !border-blue-600"
                              onClick={() => handleReserve(part.inventoryPartId!, req._id, part.quantity)}
                              disabled={actionLoading === `${req._id}-${part.inventoryPartId}-reserve`}
                            >
                              {actionLoading === `${req._id}-${part.inventoryPartId}-reserve` ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                              Reserve Stock
                            </button>
                          )}

                          {part.status === 'RESERVED' && part.inventoryPartId && (
                            <button 
                              className="btn-primary !py-1.5 !px-3 !text-xs !rounded-lg flex items-center gap-2"
                              onClick={() => handleInstall(part.inventoryPartId!, req._id, part.quantity)}
                              disabled={actionLoading === `${req._id}-${part.inventoryPartId}-install`}
                            >
                              {actionLoading === `${req._id}-${part.inventoryPartId}-install` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              Mark Installed
                            </button>
                          )}

                          {part.status === 'INSTALLED' && (
                            <div className="flex items-center gap-1.5 text-green-500 px-3">
                              <CheckCircle2 size={16} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Completed</span>
                            </div>
                          )}

                          {!part.inventoryPartId && part.status !== 'INSTALLED' && (
                            <div className="flex items-center gap-1.5 text-orange-400 px-3" title="This part is not linked to an inventory item.">
                              <AlertCircle size={16} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Not in Stock</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )
        )}

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

                    {isManager && (
                      <>
                        <div className="h-8 w-[1px] bg-white/10 mx-2" />
                        <button 
                          className="btn-primary !py-2 !px-4 !text-xs !rounded-lg flex items-center gap-2 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white !border-transparent hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all"
                          onClick={() => handleRestock(p._id, p.partName)}
                          disabled={actionLoading === `restock-${p._id}`}
                        >
                          {actionLoading === `restock-${p._id}` ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                          Restock Part
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default WorkshopRequirements;
