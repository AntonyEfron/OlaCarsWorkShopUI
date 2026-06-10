import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createPart,
  getPartById,
  updatePart,
  type PartCategory,
  type UnitType
} from '../services/inventoryService';
import { getAccountingCodes, getTaxProfiles } from '../services/serviceBillService';
import { getBranchId } from '../utils/auth';

const CATEGORIES: PartCategory[] = [
  'Engine', 'Transmission', 'Brakes', 'Suspension', 'Electrical',
  'Body', 'Tyres', 'Fluids', 'Filters', 'Belts', 'Cooling',
  'Exhaust', 'Interior', 'Other'
];

const UNITS: UnitType[] = ['piece', 'litre', 'kg', 'metre', 'set', 'pair', 'box'];

const CreatePart = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const branchId = getBranchId() || '';

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accountingCodes, setAccountingCodes] = useState<any[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<any[]>([]);

  // Form State
  const [form, setForm] = useState({
    partName: '',
    partNumber: '',
    category: 'Other' as PartCategory,
    unit: 'piece' as UnitType,
    unitCost: 0, // represents selling price
    reorderLevel: 5,
    description: '',
    inventoryAccountId: '',
    purchaseAccountId: '',
    incomeAccountId: '',
    taxId: ''
  });

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const [codes, taxes] = await Promise.all([
        getAccountingCodes(),
        getTaxProfiles()
      ]);

      setAccountingCodes(codes || []);
      setTaxProfiles(taxes || []);
      
      // Auto-fetch default accounting codes & tax
      const defaultPurchase = codes?.find((c: any) => c.code === 'CGS0001');
      const defaultIncome = codes?.find((c: any) => c.code === 'IN0008');
      const defaultInventory = codes?.find((c: any) => c.code === 'AST0001');
      const defaultTax = taxes?.find((t: any) => t.name === 'ITBMS');

      setForm(prev => ({
        ...prev,
        inventoryAccountId: defaultInventory?._id || '',
        purchaseAccountId: defaultPurchase?._id || '',
        incomeAccountId: defaultIncome?._id || '',
        taxId: defaultTax?._id || ''
      }));

      // If editing, load the part data after loading codes & tax profiles
      if (id) {
        loadPartData(id);
      }
    } catch (err: any) {
      toast.error('Failed to load form lookup data');
    }
  };

  const loadPartData = async (partId: string) => {
    setLoading(true);
    try {
      const part = await getPartById(partId);
      setForm({
        partName: part.partName,
        partNumber: part.partNumber,
        category: part.category,
        unit: part.unit,
        unitCost: part.unitCost,
        reorderLevel: part.reorderLevel,
        description: part.description || '',
        inventoryAccountId: part.inventoryAccountId?._id || part.inventoryAccountId || '',
        purchaseAccountId: part.purchaseAccountId?._id || part.purchaseAccountId || '',
        incomeAccountId: part.incomeAccountId?._id || part.incomeAccountId || '',
        taxId: part.taxId?._id || part.taxId || ''
      });
    } catch (err: any) {
      toast.error('Failed to load part details');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partName || !form.partNumber) {
      toast.error('Part Name and Part ID are required.');
      return;
    }
    if (!form.inventoryAccountId || !form.purchaseAccountId || !form.incomeAccountId) {
      toast.error('All accounting codes are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        branchId
      };

      if (id) {
        await updatePart(id, payload);
        toast.success('Part updated successfully');
      } else {
        await createPart(payload);
        toast.success('Part added to inventory');
      }
      navigate('/inventory');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeInUp">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/inventory')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-main)' }}
          >
            <ArrowLeft size={14} /> Back to Inventory
          </button>
          <h1 className="text-2xl font-bold animate-fadeIn" style={{ color: 'var(--text-main)' }}>
            {id ? 'Edit Part' : 'Add New Part'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {id ? 'Modify the selected inventory part details.' : 'Create a new inventory part records.'}
          </p>
        </div>
      </div>

      {/* Main Form Box */}
      <div className="glass-card p-6 sm:p-8 relative overflow-hidden">
        {/* Decorative ambient light */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brand-lime)]/5 rounded-full blur-[80px] pointer-events-none" />

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Part Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Part Name</label>
              <input
                required
                type="text"
                placeholder="e.g., Brake Pad Set"
                className="input-field"
                value={form.partName}
                onChange={(e) => setForm({ ...form, partName: e.target.value })}
              />
            </div>

            {/* Part ID / Serial Number */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Part ID</label>
              <input
                required
                type="text"
                placeholder="e.g., BP-44221-X"
                className="input-field font-mono uppercase"
                value={form.partNumber}
                onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as PartCategory })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Unit Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Unit Type</label>
              <select
                className="input-field"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value as UnitType })}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Selling Price / unitCost */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Selling Price ($)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input-field"
                value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
              />
            </div>

            {/* Reorder Level */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Reorder Level (Min Stock)</label>
              <input
                required
                type="number"
                min="0"
                placeholder="5"
                className="input-field"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })}
              />
            </div>

            {/* Inventory Accounting Code */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Inventory Accounting Code</label>
              <select
                required
                className="input-field"
                value={form.inventoryAccountId}
                onChange={(e) => setForm({ ...form, inventoryAccountId: e.target.value })}
              >
                <option value="">Select Account Code</option>
                {accountingCodes.map(code => (
                  <option key={code._id} value={code._id}>
                    {code.code} - {code.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Purchase Accounting Code */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Purchase Accounting Code</label>
              <select
                required
                className="input-field"
                value={form.purchaseAccountId}
                onChange={(e) => setForm({ ...form, purchaseAccountId: e.target.value })}
              >
                <option value="">Select Account Code</option>
                {accountingCodes.map(code => (
                  <option key={code._id} value={code._id}>
                    {code.code} - {code.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Income Accounting Code */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Income Accounting Code</label>
              <select
                required
                className="input-field"
                value={form.incomeAccountId}
                onChange={(e) => setForm({ ...form, incomeAccountId: e.target.value })}
              >
                <option value="">Select Account Code</option>
                {accountingCodes.map(code => (
                  <option key={code._id} value={code._id}>
                    {code.code} - {code.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax Profile */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Tax Profile</label>
              <select
                className="input-field"
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              >
                <option value="">Select Tax Profile</option>
                {taxProfiles.map(tax => (
                  <option key={tax._id} value={tax._id}>
                    {tax.name} - {tax.rate}%
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Description (Optional)</label>
            <textarea
              rows={4}
              placeholder="Enter part description, manufacturer info, fitment details..."
              className="input-field resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-[var(--border-main)]">
            <button
              type="button"
              className="btn-secondary sm:flex-1"
              onClick={() => navigate('/inventory')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary sm:flex-1 flex items-center justify-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {id ? 'Update Part' : 'Add to Inventory'}
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default CreatePart;
