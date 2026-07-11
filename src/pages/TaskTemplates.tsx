import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wrench, Plus, Search, Trash2, Edit2, Loader2,
  X, Check, AlertTriangle, Layers, Info, CheckSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  type TaskTemplate,
  type LinkedPart
} from '../services/taskTemplateService';
import { getParts, type InventoryPart } from '../services/inventoryService';
import { getBranchId, getUserRole } from '../utils/auth';

const WO_TYPES = [
  "PREVENTIVE", "CORRECTIVE", "PRE_ENTRY", "ACCIDENT",
  "RETURN_INSPECTION", "RECALL", "SAFETY_PREP", "WEAR_ITEM", "OTHER"
];

const CATEGORIES = ["Mechanical", "Electrical", "Body", "Tyres", "Fluids", "Other"];

const TaskTemplates = () => {
  const { t } = useTranslation();
  const branchId = getBranchId() || '';
  const role = getUserRole();
  const isManager = role === 'workshopmanager' || role === 'admin' || role === 'branchmanager' || role === 'workshopstaff';

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeWoType, setActiveWoType] = useState<string>("PREVENTIVE");

  // Modals / Form State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Mechanical',
    estimatedHours: 0.5,
    workOrderTypes: [] as string[]
  });
  const [linkedParts, setLinkedParts] = useState<Array<{
    inventoryPartId: string;
    partName: string;
    partNumber: string;
    defaultQuantity: number;
  }>>([]);

  // Part Selection State for editing linked parts
  const [selectedPartId, setSelectedPartId] = useState('');
  const [partQty, setPartQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [branchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesData, partsData] = await Promise.all([
        getTaskTemplates({ branchId }),
        getParts({ branchId, category: 'Parts' })
      ]);
      setTemplates(templatesData);
      setParts(partsData);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load task template details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      category: 'Mechanical',
      estimatedHours: 0.5,
      workOrderTypes: [activeWoType]
    });
    setLinkedParts([]);
    setSelectedPartId('');
    setPartQty(1);
    setShowModal(true);
  };

  const handleOpenEdit = (template: TaskTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      estimatedHours: template.estimatedHours || 0.5,
      workOrderTypes: template.workOrderTypes
    });
    setLinkedParts(
      template.linkedParts.map(lp => ({
        inventoryPartId: typeof lp.inventoryPartId === 'object' ? lp.inventoryPartId._id : lp.inventoryPartId,
        partName: lp.partName,
        partNumber: lp.partNumber,
        defaultQuantity: lp.defaultQuantity
      }))
    );
    setSelectedPartId('');
    setPartQty(1);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this task template?')) return;
    try {
      await deleteTaskTemplate(id);
      toast.success('Task template deleted successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete template');
    }
  };

  const handleToggleWoType = (type: string) => {
    const current = [...formData.workOrderTypes];
    if (current.includes(type)) {
      setFormData({ ...formData, workOrderTypes: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, workOrderTypes: [...current, type] });
    }
  };

  const handleAddPart = () => {
    if (!selectedPartId) return;
    const part = parts.find(p => p._id === selectedPartId);
    if (!part) return;

    // Check duplicate
    if (linkedParts.some(lp => lp.inventoryPartId === selectedPartId)) {
      toast.error('Part is already added to this template.');
      return;
    }

    setLinkedParts([
      ...linkedParts,
      {
        inventoryPartId: part._id,
        partName: part.partName,
        partNumber: part.partNumber,
        defaultQuantity: partQty
      }
    ]);
    setSelectedPartId('');
    setPartQty(1);
  };

  const handleRemovePart = (partId: string) => {
    setLinkedParts(linkedParts.filter(lp => lp.inventoryPartId !== partId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error('Task name is required.');
    if (formData.workOrderTypes.length === 0) return toast.error('Select at least one Work Order Type.');

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        linkedParts,
        branchId
      };

      if (editingTemplate) {
        await updateTaskTemplate(editingTemplate._id, payload);
        toast.success('Task template updated successfully!');
      } else {
        await createTaskTemplate(payload);
        toast.success('Task template created successfully!');
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter templates by selected Work Order Type and Search Term
  const filteredTemplates = templates.filter(t => {
    const matchesWoType = t.workOrderTypes.includes(activeWoType);
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.linkedParts.some(lp => lp.partName.toLowerCase().includes(searchTerm.toLowerCase()) || lp.partNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesWoType && matchesSearch;
  });

  return (
    <>
      <div className="space-y-6 animate-fadeInUp">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <Layers className="text-[var(--brand-lime)]" size={26} />
              Task & Part Preset Mapping
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Define standard tasks and their required inventory parts for each Work Order Type.
            </p>
          </div>
          {isManager && (
            <button className="btn-primary" onClick={handleOpenCreate}>
              <Plus size={18} /> Create Task Preset
            </button>
          )}
        </div>

        {/* WO Type Navigation Tabs */}
        <div className="flex flex-wrap gap-2 pb-1 border-b border-[var(--border-main)]">
          {WO_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setActiveWoType(type)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeWoType === type
                  ? 'bg-[var(--brand-lime)] text-black font-black'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              placeholder="Search tasks, descriptions, or parts..."
              className="input-field pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="glass-card p-12 text-center text-[var(--text-muted)]">
            <Wrench className="mx-auto mb-3 opacity-30 animate-pulse" size={48} />
            <p className="text-lg font-bold">No task presets defined for {activeWoType.replace('_', ' ')}</p>
            <p className="text-sm mt-1 opacity-70">Add templates to automate part provisioning when checking tasks on work orders.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTemplates.map(t => (
              <div
                key={t._id}
                className="glass-card p-6 flex flex-col justify-between border hover:border-[var(--brand-lime)]/30 transition-all group relative"
              >
                <div className="space-y-4">
                  {/* Top line details */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-extrabold text-white">{t.name}</h3>
                      {t.description && <p className="text-xs text-gray-400 mt-1">{t.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                        {t.category}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] font-bold">
                        {t.estimatedHours || 0.5} hrs
                      </span>
                    </div>
                  </div>

                  {/* Linked parts section */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-gray-400 flex items-center gap-1.5">
                      <CheckSquare size={12} className="text-[var(--brand-lime)]" />
                      Required Parts ({t.linkedParts.length})
                    </p>
                    {t.linkedParts.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No parts assigned to this task.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {t.linkedParts.map((lp, idx) => {
                          const partDetail = typeof lp.inventoryPartId === 'object' ? lp.inventoryPartId : null;
                          const onHand = partDetail?.quantityOnHand ?? 0;
                          const reserved = partDetail?.quantityReserved ?? 0;
                          const available = onHand - reserved;

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-gray-200 truncate">{lp.partName}</p>
                                <p className="text-[9px] font-mono text-gray-500 uppercase">{lp.partNumber}</p>
                              </div>
                              <div className="text-right flex items-center gap-3">
                                <div>
                                  <span className="font-bold text-[var(--brand-lime)]">Qty: {lp.defaultQuantity}</span>
                                  {partDetail && (
                                    <span className={`block text-[9px] ${available <= 0 ? 'text-red-500 font-extrabold' : 'text-gray-400'}`}>
                                      Stock: {available} avl
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit / Delete Buttons on Hover */}
                {isManager && (
                  <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[var(--bg-main)]/80 backdrop-blur p-1 rounded-xl border border-white/10 shadow-lg">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(t._id)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white/5"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-xl p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto relative border border-[var(--border-main)] rounded-[2.5rem]">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                  <Layers className="text-[var(--brand-lime)]" size={24} />
                  {editingTemplate ? 'Edit Task Preset' : 'Create Task Preset'}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">Configure standard actions and mapped vehicle components</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-3 hover:bg-[var(--bg-input)] rounded-2xl border border-[var(--border-main)] text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Input fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Task Preset Name</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. OIL FILTER CHANGE"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Description (Optional)</label>
                  <textarea
                    rows={2}
                    className="input-field py-3 resize-none"
                    placeholder="Short summary of task execution details..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Category</label>
                    <select
                      className="input-field"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Estimated Hours</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className="input-field"
                      value={formData.estimatedHours}
                      onChange={(e) => setFormData({ ...formData, estimatedHours: Number(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Target WO Types */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Applicable Work Order Types</label>
                  <div className="flex flex-wrap gap-2">
                    {WO_TYPES.map(type => {
                      const isSelected = formData.workOrderTypes.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleToggleWoType(type)}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all border ${
                            isSelected
                              ? 'bg-[var(--brand-lime-alpha)] border-[var(--brand-lime)] text-[var(--brand-lime)]'
                              : 'bg-white/5 border-transparent text-gray-400 hover:text-white'
                          }`}
                        >
                          {type.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Inventory Part Linker */}
              <div className="border-t border-[var(--border-main)] pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <CheckSquare size={16} className="text-[var(--brand-lime)]" />
                    Assign Required Parts
                  </h3>
                  <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400">
                    {linkedParts.length} parts mapped
                  </span>
                </div>

                {/* Selector interface */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <select
                      className="input-field"
                      value={selectedPartId}
                      onChange={(e) => setSelectedPartId(e.target.value)}
                    >
                      <option value="">-- Choose Inventory Part --</option>
                      {parts.map(p => {
                        const available = p.quantityOnHand - p.quantityReserved;
                        return (
                          <option key={p._id} value={p._id} disabled={!p.isActive}>
                            {p.partNumber} - {p.partName} ({available} available)
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      className="input-field text-center"
                      value={partQty}
                      onChange={(e) => setPartQty(Math.max(1, Number(e.target.value)))}
                      placeholder="Qty"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPart}
                    className="btn-secondary !py-0 !px-4 hover:border-[var(--brand-lime)]/50 text-[var(--brand-lime)] flex items-center gap-1"
                  >
                    Add
                  </button>
                </div>

                {/* Listed parts */}
                {linkedParts.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border border-[var(--border-main)] rounded-2xl overflow-hidden divide-y divide-white/5 bg-white/[0.01]">
                    {linkedParts.map((lp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs">
                        <div className="min-w-0 pr-3">
                          <p className="font-bold text-gray-200 truncate">{lp.partName}</p>
                          <p className="text-[9px] font-mono text-gray-500 uppercase">{lp.partNumber}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-[var(--brand-lime)]">Qty: {lp.defaultQuantity}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(lp.inventoryPartId)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white/5"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t border-[var(--border-main)]">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Save Presets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskTemplates;
