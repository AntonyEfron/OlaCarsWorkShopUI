import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, Plus, Search, Filter, AlertTriangle, 
  ArrowUpRight, History, Trash2, Edit2, Loader2,
  ChevronDown, X, CheckCircle2, MoreHorizontal, Truck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getParts, createPart, updatePart, deletePart, restockPart,
  type InventoryPart, type PartCategory, type UnitType
} from '../services/inventoryService';
import { getUser } from '../utils/auth';

const CATEGORIES: PartCategory[] = [
  'Engine', 'Transmission', 'Brakes', 'Suspension', 'Electrical', 
  'Body', 'Tyres', 'Fluids', 'Filters', 'Belts', 'Cooling', 
  'Exhaust', 'Interior', 'Other'
];

const UNITS: UnitType[] = ['piece', 'litre', 'kg', 'metre', 'set', 'pair', 'box'];

const Inventory = () => {
  const { t } = useTranslation();
  const user = getUser();
  const branchId = (user?.branchId as string) || '';
  const isManager = (user?.role as string)?.toUpperCase() === 'WORKSHOPMANAGER';

  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<InventoryPart | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    partName: '',
    partNumber: '',
    category: 'Other' as PartCategory,
    unit: 'piece' as UnitType,
    unitCost: 0,
    reorderLevel: 5,
    description: ''
  });

  useEffect(() => {
    loadParts();
  }, [categoryFilter, branchId]);

  const loadParts = async () => {
    setLoading(true);
    try {
      const filters: any = { branchId };
      if (categoryFilter) filters.category = categoryFilter;
      const data = await getParts(filters);
      setParts(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(p => 
    p.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.partNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (selectedPart) {
        await updatePart(selectedPart._id, form);
        toast.success('Part updated successfully');
      } else {
        await createPart({ ...form, branchId });
        toast.success('Part added to inventory');
      }
      setShowAddModal(false);
      setSelectedPart(null);
      resetForm();
      loadParts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestock = async () => {
    if (!selectedPart) return;
    setSubmitting(true);
    try {
      await restockPart(selectedPart._id, restockQty);
      toast.success(`Restocked ${restockQty} ${selectedPart.unit}(s)`);
      setShowRestockModal(false);
      loadParts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Restock failed');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      partName: '',
      partNumber: '',
      category: 'Other',
      unit: 'piece',
      unitCost: 0,
      reorderLevel: 5,
      description: ''
    });
  };

  const openEdit = (part: InventoryPart) => {
    setSelectedPart(part);
    setForm({
      partName: part.partName,
      partNumber: part.partNumber,
      category: part.category,
      unit: part.unit,
      unitCost: part.unitCost,
      reorderLevel: part.reorderLevel,
      description: part.description || ''
    });
    setShowAddModal(true);
  };

  if (loading && parts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Parts Inventory</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your workshop stock and tracking.</p>
        </div>
        {isManager && (
          <button 
            className="btn-primary" 
            onClick={() => { resetForm(); setSelectedPart(null); setShowAddModal(true); }}
          >
            <Plus size={18} /> Add New Part
          </button>
        )}
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Package size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-dim)' }}>Total Items</p>
            <p className="text-xl font-bold">{parts.length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <AlertTriangle size={20} className="text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-dim)' }}>Low Stock</p>
            <p className="text-xl font-bold text-orange-500">{parts.filter(p => p.isLowStock).length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 size={20} className="text-green-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-dim)' }}>In Stock</p>
            <p className="text-xl font-bold text-green-500">{parts.filter(p => p.quantityOnHand > 0).length}</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-4 border-l-2 border-[var(--brand-lime)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand-lime-alpha)] flex items-center justify-center">
            <ArrowUpRight size={20} className="text-[var(--brand-lime)]" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-dim)' }}>Active Reservations</p>
            <p className="text-xl font-bold" style={{ color: 'var(--brand-lime)' }}>
              {parts.reduce((acc, p) => acc + p.quantityReserved, 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input 
              type="text" 
              placeholder="Search by part name or serial number..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            className={`btn-secondary ${categoryFilter || showFilters ? '!border-lime !text-lime' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} /> Filters
            <ChevronDown size={14} className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-main)' }}>
            <button 
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!categoryFilter ? 'bg-[var(--brand-lime)] text-black' : 'bg-[var(--bg-input)] hover:bg-[var(--border-main)] opacity-70'}`}
              onClick={() => setCategoryFilter('')}
            >
              All Categories
            </button>
            {CATEGORIES.map(cat => (
              <button 
                key={cat}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${categoryFilter === cat ? 'bg-[var(--brand-lime)] text-black' : 'bg-[var(--bg-input)] hover:bg-[var(--border-main)] opacity-70'}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Parts Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="!pl-6">Part Info</th>
                <th>Category</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th className="text-center">Stock Level</th>
                <th className="text-right !pr-6">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center opacity-40">
                    <Package size={40} className="mx-auto mb-3" />
                    <p>No parts found matching your search.</p>
                  </td>
                </tr>
              ) : (
                filteredParts.map(part => (
                  <tr key={part._id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="!pl-6">
                      <div>
                        <p className="text-sm font-bold truncate max-w-[200px]" style={{ color: 'var(--text-main)' }}>{part.partName}</p>
                        <p className="text-[10px] font-mono opacity-50 uppercase">{part.partNumber}</p>
                      </div>
                    </td>
                    <td>
                      <span className="text-[10px] px-2 py-1 rounded bg-[var(--bg-input)] font-medium">
                        {part.category}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm font-mono font-bold" style={{ color: part.isLowStock ? 'var(--alert-red)' : '' }}>
                        {part.quantityOnHand} {part.unit}(s)
                      </span>
                    </td>
                    <td>
                      <p className="text-sm font-mono opacity-60">{part.quantityReserved}</p>
                    </td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-24 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${part.isLowStock ? 'bg-orange-500' : 'bg-[var(--brand-lime)]'}`}
                            style={{ width: `${Math.min((part.quantityOnHand / (part.reorderLevel * 4)) * 100, 100)}%` }}
                          />
                        </div>
                        {part.isLowStock && (
                          <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Low Stock</span>
                        )}
                      </div>
                    </td>
                    <td className="!pr-6 text-right">
                      {/* Stable container to prevent layout shift */}
                      <div className="flex items-center justify-end min-w-[120px] h-10">
                        {/* Hover Actions */}
                        <div className="hidden group-hover:flex items-center gap-1 transition-all">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSelectedPart(part); setRestockQty(1); setShowRestockModal(true); }}
                            className="p-2 rounded-lg hover:bg-[var(--brand-lime-alpha)] hover:text-[var(--brand-lime)] transition-colors"
                            title="Restock"
                          >
                            < Truck size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEdit(part); }}
                            className="p-2 rounded-lg hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          {isManager && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                if(window.confirm('Are you sure you want to delete this part?')) {
                                  await deletePart(part._id);
                                  loadParts();
                                }
                              }}
                              className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        
                        {/* Default View - More Icon */}
                        <div className="group-hover:hidden py-2 px-1">
                          <MoreHorizontal size={14} className="opacity-30" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedPart ? 'Edit Part' : 'Add New Part'}</h2>
              <button 
                onClick={() => { setShowAddModal(false); setSelectedPart(null); }}
                className="p-2 hover:bg-[var(--bg-input)] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Part Name</label>
                  <input 
                    required
                    placeholder="e.g., Brake Pad Set"
                    className="input-field"
                    value={form.partName}
                    onChange={(e) => setForm({...form, partName: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Part/Serial Number</label>
                  <input 
                    required
                    placeholder="e.g., BP-44221-X"
                    className="input-field font-mono"
                    value={form.partNumber}
                    onChange={(e) => setForm({...form, partNumber: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Category</label>
                  <select 
                    className="input-field"
                    value={form.category}
                    onChange={(e) => setForm({...form, category: e.target.value as PartCategory})}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Unit Type</label>
                  <select 
                    className="input-field"
                    value={form.unit}
                    onChange={(e) => setForm({...form, unit: e.target.value as UnitType})}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Unit Cost ($)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="input-field"
                    value={form.unitCost}
                    onChange={(e) => setForm({...form, unitCost: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Reorder Level (Min Stock)</label>
                  <input 
                    type="number"
                    placeholder="5"
                    className="input-field"
                    value={form.reorderLevel}
                    onChange={(e) => setForm({...form, reorderLevel: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Description (Optional)</label>
                <textarea 
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Additional details, manufacturer, fitment info..."
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  className="btn-secondary flex-1"
                  onClick={() => { setShowAddModal(false); setSelectedPart(null); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : (selectedPart ? 'Update Part' : 'Add to Inventory')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedPart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-sm p-6 space-y-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
              <Truck size={32} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Restock Part</h2>
              <p className="text-sm opacity-60 mt-1">{selectedPart.partName}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">New Quantity Received ({selectedPart.unit})</label>
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
                  disabled={submitting || restockQty < 1}
                  onClick={handleRestock}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Restock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
