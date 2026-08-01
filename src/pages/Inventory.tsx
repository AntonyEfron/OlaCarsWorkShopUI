import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Package, Plus, Search, Filter, AlertTriangle,
  ArrowUpRight, History, Trash2, Edit2, Loader2,
  ChevronDown, X, CheckCircle2, MoreHorizontal, Truck, Upload,
  ShoppingCart, XCircle, TrendingUp, TrendingDown,
  Lock, Unlock, ShieldAlert, FileSpreadsheet, Layers, Calendar, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getParts, createPart, updatePart, deletePart, bulkCreateParts,
  blockMaterialCode, blockPartQuantity, getMultiStockOverview, getConsumptionReport,
  type InventoryPart, type PartCategory, type UnitType
} from '../services/inventoryService';
import { getScrapItems } from '../services/scrapService';
import { createProcurementRequest } from '../services/workshopProcurementService';
import { getSuppliers, type Supplier } from '../services/supplierService';
import { getAccountingCodes, getTaxProfiles } from '../services/serviceBillService';
import { getUser, getUserRole, getBranchId } from '../utils/auth';
import * as XLSX from 'xlsx';

const CATEGORIES: PartCategory[] = [
  'Engine', 'Transmission', 'Brakes', 'Suspension', 'Electrical',
  'Body', 'Tyres', 'Fluids', 'Filters', 'Belts', 'Cooling',
  'Exhaust', 'Interior', 'Parts', 'Other'
];

const UNITS: UnitType[] = ['piece', 'litre', 'kg', 'metre', 'set', 'pair', 'box'];

const Inventory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = getUser();
  const branchId = getBranchId() || '';
  const role = getUserRole();
  const isManager = role === 'workshopmanager';
  const isStaff = role === 'workshopstaff';
  const canAddInventory = isManager || isStaff;

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'MULTI_OVERVIEW' | 'CONSUMPTION_REPORT'>('CATALOG');

  // Parts List State
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [scrappedCount, setScrappedCount] = useState(0);
  const [kpiFilter, setKpiFilter] = useState<'ALL' | 'SAFE' | 'LOW' | 'OUT' | 'FAST' | 'NON_MOVING' | 'BLOCKED'>('ALL');

  // Modals
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedPart, setSelectedPart] = useState<InventoryPart | null>(null);

  // Block Modal Form
  const [blockForm, setBlockForm] = useState({
    isBlocked: false,
    quantityBlocked: 0,
    blockedReason: ''
  });

  // Bulk Upload State
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [accountingCodes, setAccountingCodes] = useState<any[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<any[]>([]);

  // ── Multi-Item Stock Overview State ──
  const [multiCodesInput, setMultiCodesInput] = useState('SP-1002-PT, EO-5W30-4L, BAT-001');
  const [multiOverviewData, setMultiOverviewData] = useState<any[]>([]);
  const [multiOverviewLoading, setMultiOverviewLoading] = useState(false);

  // ── Consumption Reports State ──
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'half-yearly' | 'yearly'>('monthly');
  const [reportFilterMode, setReportFilterMode] = useState<'ALL' | 'SINGLE' | 'MULTI'>('ALL');
  const [reportItemCodes, setReportItemCodes] = useState('');
  const [consumptionReport, setConsumptionReport] = useState<any>(null);
  const [consumptionReportLoading, setConsumptionReportLoading] = useState(false);

  useEffect(() => {
    loadParts();
    loadLookupData();
  }, [branchId]);

  const loadLookupData = async () => {
    try {
      const [codes, taxes] = await Promise.all([
        getAccountingCodes(),
        getTaxProfiles()
      ]);
      setAccountingCodes(codes || []);
      setTaxProfiles(taxes || []);
    } catch (err) {
      // Non-critical
    }
  };

  const loadParts = async () => {
    setLoading(true);
    try {
      const filters: any = { branchId, category: 'Parts' };
      const [partsData, scrapData] = await Promise.all([
        getParts(filters),
        getScrapItems()
      ]);
      setParts(partsData);
      setScrappedCount(Array.isArray(scrapData) ? scrapData.reduce((sum: number, item: any) => sum + item.quantity, 0) : 0);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const filteredParts = parts.filter(p => {
    const matchesSearch = p.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (kpiFilter === 'SAFE') return !p.isLowStock && p.quantityOnHand > 0 && !p.isBlocked;
    if (kpiFilter === 'LOW') return p.isLowStock && p.quantityOnHand > 0 && !p.isBlocked;
    if (kpiFilter === 'OUT') return p.quantityOnHand === 0 && !p.isBlocked;
    if (kpiFilter === 'FAST') return p.quantityReserved > 0;
    if (kpiFilter === 'NON_MOVING') return p.quantityReserved === 0 && p.quantityOnHand > 0;
    if (kpiFilter === 'BLOCKED') return p.isBlocked || (p.quantityBlocked && p.quantityBlocked > 0);

    return true;
  });

  // ── Blocking Actions ──
  const openBlockModal = (part: InventoryPart) => {
    setSelectedPart(part);
    setBlockForm({
      isBlocked: !!part.isBlocked,
      quantityBlocked: part.quantityBlocked || 0,
      blockedReason: part.blockedReason || ''
    });
    setShowBlockModal(true);
  };

  const handleSaveBlock = async () => {
    if (!selectedPart) return;
    setSubmitting(true);
    try {
      if (blockForm.isBlocked !== !!selectedPart.isBlocked) {
        await blockMaterialCode(selectedPart._id, blockForm.isBlocked, blockForm.blockedReason);
      }
      if (blockForm.quantityBlocked !== (selectedPart.quantityBlocked || 0)) {
        await blockPartQuantity(selectedPart._id, blockForm.quantityBlocked, blockForm.blockedReason);
      }
      toast.success(`Block settings updated for ${selectedPart.partNumber}`);
      setShowBlockModal(false);
      loadParts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update block settings');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Multi-Stock Overview Handler ──
  const handleFetchMultiOverview = async () => {
    setMultiOverviewLoading(true);
    try {
      const res = await getMultiStockOverview(multiCodesInput, branchId);
      setMultiOverviewData(res.data || []);
      toast.success(`Found ${res.totalFound || 0} matching spare parts!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch stock overview');
    } finally {
      setMultiOverviewLoading(false);
    }
  };

  // ── Consumption Report Handler ──
  const handleFetchConsumptionReport = async () => {
    setConsumptionReportLoading(true);
    try {
      let codesToFilter = '';
      if (reportFilterMode !== 'ALL') {
        codesToFilter = reportItemCodes;
      }
      const res = await getConsumptionReport({
        period: reportPeriod,
        itemCodes: codesToFilter,
        branchId
      });
      setConsumptionReport(res);
      toast.success(`Generated ${reportPeriod.toUpperCase()} consumption report`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate consumption report');
    } finally {
      setConsumptionReportLoading(false);
    }
  };

  const handleExportConsumptionExcel = () => {
    if (!consumptionReport || !consumptionReport.data || consumptionReport.data.length === 0) {
      toast.error('No consumption report data to export.');
      return;
    }
    try {
      const exportRows = consumptionReport.data.map((item: any) => ({
        'Part Number': item.partNumber,
        'Part Name': item.partName,
        'Category': item.category,
        'Unit': item.unit,
        'Unit Cost ($)': item.unitCost,
        'Total Quantity Consumed': item.totalQuantity,
        'Total Consumption Cost ($)': item.totalCost,
        'Transaction Count': item.transactions?.length || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Consumption Report');
      
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `spare_parts_consumption_${reportPeriod}_${dateStr}.xlsx`);
      toast.success('Consumption report exported to Excel!');
    } catch (err) {
      toast.error('Failed to export Excel report');
    }
  };

  const handleRestock = async () => {
    if (!selectedPart) return;
    setSubmitting(true);
    try {
      await createProcurementRequest({
        part: selectedPart._id,
        quantity: restockQty,
        notes: `Purchase request for item: ${selectedPart.partName}`
      });
      toast.success(`Purchase request for ${restockQty} ${selectedPart.unit}(s) created successfully!`);
      setShowRestockModal(false);
      loadParts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    try {
      const sampleData = [
        {
          partName: 'Spark Plug Platinum',
          partNumber: 'SP-1002-PT',
          category: 'Electrical',
          unit: 'piece',
          sellingPrice: 12.99,
          quantityOnHand: 50,
          reorderLevel: 10,
          description: 'High-performance platinum spark plug',
          inventoryAccountCode: 'AST0001',
          purchaseAccountCode: 'CGS0001',
          incomeAccountCode: 'IN0008',
          taxProfileName: 'ITBMS'
        },
        {
          partName: 'Engine Oil 5W-30',
          partNumber: 'EO-5W30-4L',
          category: 'Fluids',
          unit: 'litre',
          sellingPrice: 35.50,
          quantityOnHand: 20,
          reorderLevel: 5,
          description: 'Synthetic engine oil 4L container',
          inventoryAccountCode: 'AST0001',
          purchaseAccountCode: 'CGS0001',
          incomeAccountCode: 'IN0008',
          taxProfileName: 'ITBMS'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(sampleData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Parts Template');
      XLSX.writeFile(workbook, 'parts_inventory_template.xlsx');
      toast.success('Excel template downloaded!');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const parsed = XLSX.utils.sheet_to_json(worksheet) as any[];

        const errors: string[] = [];
        const validParts = parsed.map((row, index) => {
          const resolvedPartName = row.partName || row.Name || row.item_name || row['Item Name'] || '';
          const resolvedPartNumber = row.partNumber || row.SKU || row['Part Number'] || row['Item ID'] || '';

          if (!resolvedPartName || !resolvedPartNumber) {
            errors.push(`Row ${index + 2}: Missing required Part Name (Name) or SKU/Part Number`);
            return null;
          }

          let inventoryAccountId = '';
          let purchaseAccountId = '';
          let incomeAccountId = '';
          let taxId = '';

          if (row.inventoryAccountCode) {
            const match = accountingCodes.find((c: any) => c.code === String(row.inventoryAccountCode).trim());
            if (match) inventoryAccountId = match._id;
          }
          if (row.purchaseAccountCode) {
            const match = accountingCodes.find((c: any) => c.code === String(row.purchaseAccountCode).trim());
            if (match) purchaseAccountId = match._id;
          }
          if (row.incomeAccountCode) {
            const match = accountingCodes.find((c: any) => c.code === String(row.incomeAccountCode).trim());
            if (match) incomeAccountId = match._id;
          }
          if (row.taxProfileName) {
            const match = taxProfiles.find((t: any) => t.name === String(row.taxProfileName).trim());
            if (match) taxId = match._id;
          }

          const part: any = {
            partName: String(resolvedPartName).trim(),
            partNumber: String(resolvedPartNumber).trim().toUpperCase(),
            category: 'Parts',
            unit: row.unit || row.UsageUnit || row['Usage Unit'] || 'piece',
            unitCost: Number(row.sellingPrice || row.unitCost || 0),
            quantityOnHand: Number(row.quantityOnHand || row.StockOnHand || 0),
            reorderLevel: Number(row.reorderLevel || 5),
            description: row.description ? String(row.description) : ''
          };

          if (inventoryAccountId) part.inventoryAccountId = inventoryAccountId;
          if (purchaseAccountId) part.purchaseAccountId = purchaseAccountId;
          if (incomeAccountId) part.incomeAccountId = incomeAccountId;
          if (taxId) part.taxId = taxId;

          return part;
        }).filter(p => p !== null);

        setBulkErrors(errors);
        setBulkData(validParts);
        toast.success(`Successfully parsed ${validParts.length} parts from Excel file!`);
      } catch (error) {
        toast.error('Error parsing Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkSubmit = async () => {
    if (bulkData.length === 0) return;
    setSubmitting(true);
    setBulkErrors([]);
    setBulkSuccess(null);
    try {
      const response = await bulkCreateParts({ parts: bulkData.map(p => ({ ...p, branchId })) });
      if (response.errorCount && response.errorCount > 0) {
        toast.error(`Imported ${response.successCount}. Failed: ${response.errorCount}.`);
      } else {
        toast.success(`Successfully added ${response.successCount} parts!`);
      }
      setShowBulkModal(false);
      setBulkData([]);
      loadParts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && parts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[var(--brand-lime)]" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fadeInUp">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Parts & Material Inventory</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage stock, material blocks, multi-item overviews, and consumption reports.</p>
          </div>
          {canAddInventory && (
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                onClick={() => { setBulkData([]); setBulkErrors([]); setBulkSuccess(null); setShowBulkModal(true); }}
              >
                <Upload size={18} /> Bulk Upload
              </button>
              <button
                className="btn-primary"
                onClick={() => navigate('/inventory/create')}
              >
                <Plus size={18} /> Add New Part
              </button>
            </div>
          )}
        </div>

        {/* View Mode Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border-main)]/40 pb-3">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'CATALOG'
                ? 'bg-[var(--brand-lime)] text-black shadow-md'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Package size={16} /> Inventory Catalog
          </button>
          <button
            onClick={() => {
              setActiveTab('MULTI_OVERVIEW');
              if (multiOverviewData.length === 0) handleFetchMultiOverview();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'MULTI_OVERVIEW'
                ? 'bg-[var(--brand-lime)] text-black shadow-md'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Layers size={16} /> Multi-Item Stock Overview
          </button>
          <button
            onClick={() => {
              setActiveTab('CONSUMPTION_REPORT');
              if (!consumptionReport) handleFetchConsumptionReport();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'CONSUMPTION_REPORT'
                ? 'bg-[var(--brand-lime)] text-black shadow-md'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={16} /> Consumption Reports
          </button>
        </div>

        {/* ── TAB 1: INVENTORY CATALOG VIEW ── */}
        {activeTab === 'CATALOG' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Volume & Scrap */}
              <div className="stat-card p-5 flex flex-col justify-between" style={{ borderColor: 'rgba(200, 230, 0, 0.25)' }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-lime" style={{ color: 'var(--brand-lime)' }}>
                      Inventory Volume
                    </span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(200,230,0,0.1)]">
                      <Package size={18} style={{ color: 'var(--brand-lime)' }} />
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-white mb-1">{parts.length}</div>
                  <span className="text-xs text-gray-400">Total Unique Material Codes Cataloged</span>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border-main)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Decommissioned Scrap</span>
                    <div className="text-xl font-bold text-white mt-0.5">{scrappedCount} <span className="text-xs font-normal text-gray-400">items</span></div>
                  </div>
                  <button 
                    className="btn-secondary !py-1.5 !px-3 !text-xs flex items-center gap-1 hover:border-lime"
                    onClick={() => navigate('/scrap-list')}
                  >
                    View Scrap <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>

              {/* Card 2: Stock Availability Health */}
              <div className="stat-card p-5 flex flex-col justify-between" style={{ borderColor: 'rgba(39, 174, 96, 0.25)' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Stock Availability Health</span>
                  <span className="text-[10px] bg-emerald-500/10 text-[#27AE60] px-2 py-0.5 rounded font-bold uppercase tracking-wider">Status</span>
                </div>

                <div className="space-y-3">
                  <div className={`p-2 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'SAFE' ? 'bg-white/5 border-[#27AE60]' : 'border-transparent hover:bg-white/5'}`}
                    onClick={() => setKpiFilter(prev => prev === 'SAFE' ? 'ALL' : 'SAFE')}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#27AE60]" />
                        In Stock - Safe
                      </span>
                      <span className="font-bold text-white">{parts.filter(p => !p.isLowStock && p.quantityOnHand > 0 && !p.isBlocked).length}</span>
                    </div>
                  </div>

                  <div className={`p-2 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'LOW' ? 'bg-white/5 border-[#E67E22]' : 'border-transparent hover:bg-white/5'}`}
                    onClick={() => setKpiFilter(prev => prev === 'LOW' ? 'ALL' : 'LOW')}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#E67E22]" />
                        Running Low
                      </span>
                      <span className="font-bold text-white">{parts.filter(p => p.isLowStock && p.quantityOnHand > 0 && !p.isBlocked).length}</span>
                    </div>
                  </div>

                  <div className={`p-2 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'BLOCKED' ? 'bg-white/5 border-red-500' : 'border-transparent hover:bg-white/5'}`}
                    onClick={() => setKpiFilter(prev => prev === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-red-400 flex items-center gap-1.5">
                        <ShieldAlert size={14} className="text-red-500" />
                        Blocked Stock
                      </span>
                      <span className="font-bold text-red-400">{parts.filter(p => p.isBlocked || (p.quantityBlocked && p.quantityBlocked > 0)).length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Demand Velocity */}
              <div className="stat-card p-5 flex flex-col justify-between" style={{ borderColor: 'rgba(155, 89, 182, 0.25)' }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Demand Velocity</span>
                  <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Activity</span>
                </div>

                <div className="space-y-4 my-auto">
                  <div className={`p-3.5 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'FAST' ? 'bg-white/5 border-[#F39C12]' : 'border-transparent hover:bg-white/5'}`}
                    onClick={() => setKpiFilter(prev => prev === 'FAST' ? 'ALL' : 'FAST')}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-[#F39C12]" />
                        Fast Moving (Reserved)
                      </span>
                      <span className="font-bold text-white">{parts.filter(p => p.quantityReserved > 0).length}</span>
                    </div>
                  </div>

                  <div className={`p-3.5 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'NON_MOVING' ? 'bg-white/5 border-[#9B59B6]' : 'border-transparent hover:bg-white/5'}`}
                    onClick={() => setKpiFilter(prev => prev === 'NON_MOVING' ? 'ALL' : 'NON_MOVING')}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                        <TrendingDown size={14} className="text-[#9B59B6]" />
                        Non-Moving Stock
                      </span>
                      <span className="font-bold text-white">{parts.filter(p => p.quantityReserved === 0 && p.quantityOnHand > 0).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Filter */}
            <div className="glass-card p-4">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input
                    type="text"
                    placeholder="Search by part name or part ID / code..."
                    className="input-field pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Parts Catalog Table */}
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="!pl-6">Material Code & Name</th>
                      <th>Category</th>
                      <th>On Hand</th>
                      <th>Reserved</th>
                      <th>Blocked Stock</th>
                      <th>Available</th>
                      <th className="text-center">Stock Level</th>
                      <th className="text-right !pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center opacity-40">
                          <Package size={40} className="mx-auto mb-3" />
                          <p>No parts found matching your criteria.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map(part => {
                        const isFullyBlocked = !!part.isBlocked;
                        const qtyBlocked = part.quantityBlocked || 0;
                        const available = isFullyBlocked ? 0 : Math.max(0, part.quantityOnHand - part.quantityReserved - qtyBlocked);

                        return (
                          <tr key={part._id} className={`hover:bg-white/[0.02] transition-colors group ${isFullyBlocked ? 'bg-red-500/5' : ''}`}>
                            <td className="!pl-6">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-white">{part.partName}</p>
                                  {isFullyBlocked && (
                                    <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                                      <Lock size={10} /> Fully Blocked
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono opacity-50 uppercase">{part.partNumber}</p>
                              </div>
                            </td>
                            <td>
                              <span className="text-[10px] px-2 py-1 rounded bg-[var(--bg-input)] font-medium">
                                {part.category}
                              </span>
                            </td>
                            <td>
                              <span className="text-sm font-mono font-bold">
                                {part.quantityOnHand} {part.unit}(s)
                              </span>
                            </td>
                            <td>
                              <p className="text-sm font-mono opacity-60">{part.quantityReserved}</p>
                            </td>
                            <td>
                              {isFullyBlocked ? (
                                <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                                  <Lock size={12} /> Full Code Blocked
                                </span>
                              ) : qtyBlocked > 0 ? (
                                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                  <ShieldAlert size={12} /> {qtyBlocked} {part.unit}(s) Blocked
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">0</span>
                              )}
                            </td>
                            <td>
                              <span className={`text-sm font-mono font-bold ${available <= 0 ? 'text-red-400' : 'text-[var(--brand-lime)]'}`}>
                                {available} {part.unit}(s)
                              </span>
                            </td>
                            <td className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-20 h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${isFullyBlocked ? 'bg-red-500' : (part.isLowStock ? 'bg-orange-500' : 'bg-[var(--brand-lime)]')}`}
                                    style={{ width: `${Math.min((part.quantityOnHand / (part.reorderLevel * 4)) * 100, 100)}%` }}
                                  />
                                </div>
                                {isFullyBlocked ? (
                                  <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest">Blocked</span>
                                ) : part.isLowStock ? (
                                  <span className="text-[8px] font-bold text-orange-500 uppercase tracking-widest">Low Stock</span>
                                ) : null}
                              </div>
                            </td>
                            <td className="!pr-6 text-right">
                              <div className="flex items-center justify-end min-w-[140px] h-10 gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openBlockModal(part); }}
                                  className={`p-2 rounded-lg transition-colors ${isFullyBlocked || qtyBlocked > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'hover:bg-amber-500/10 hover:text-amber-400 text-gray-400'}`}
                                  title="Manage Stock Blocking"
                                >
                                  {isFullyBlocked ? <Lock size={16} /> : <ShieldAlert size={16} />}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedPart(part); setRestockQty(1); setShowRestockModal(true); }}
                                  className="p-2 rounded-lg hover:bg-[var(--brand-lime-alpha)] hover:text-[var(--brand-lime)] transition-colors text-gray-400"
                                  title="Create Purchase Request"
                                >
                                  <ShoppingCart size={16} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/inventory/edit/${part._id}`); }}
                                  className="p-2 rounded-lg hover:bg-blue-500/10 hover:text-blue-500 transition-colors text-gray-400"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                {isManager && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (window.confirm('Are you sure you want to delete this part?')) {
                                        await deletePart(part._id);
                                        loadParts();
                                      }
                                    }}
                                    className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors text-gray-400"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: MULTI-ITEM STOCK OVERVIEW SCREEN ── */}
        {activeTab === 'MULTI_OVERVIEW' && (
          <div className="space-y-6">
            <div className="glass-card p-6 space-y-4 border border-[var(--border-main)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="text-lime" size={20} /> Multi-Item Stock Overview Screen
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Input multiple Item Codes / Part Numbers (comma, space, or line separated) to compare live stock levels across items on a single screen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFetchMultiOverview}
                  disabled={multiOverviewLoading}
                  className="btn-primary !py-2.5 !px-5 flex items-center gap-2 text-xs font-bold"
                >
                  {multiOverviewLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Fetch Stock Overview
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Item Codes / Part Numbers (E.g. BAT-001, BAT-002, SP-1002-PT, EO-5W30-4L)
                </label>
                <textarea
                  value={multiCodesInput}
                  onChange={(e) => setMultiCodesInput(e.target.value)}
                  placeholder="Enter part codes separated by comma or new lines..."
                  rows={3}
                  className="input-field text-xs font-mono resize-none w-full"
                />
              </div>
            </div>

            {/* Results Table */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-[var(--border-main)] flex items-center justify-between bg-white/[0.01]">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Consolidated Overview ({multiOverviewData.length} item(s) found)
                </span>
                <span className="text-[10px] text-lime font-mono">Live Sync</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="!pl-6">Part Code</th>
                      <th>Part Name</th>
                      <th>Category</th>
                      <th>Unit Cost</th>
                      <th>Stock On Hand</th>
                      <th>Reserved</th>
                      <th>Blocked Stock</th>
                      <th>Unblocked Available</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multiOverviewData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center opacity-40">
                          <Layers size={36} className="mx-auto mb-2 text-gray-500" />
                          <p className="text-xs">No parts fetched yet. Input Item Codes above and click Fetch.</p>
                        </td>
                      </tr>
                    ) : (
                      multiOverviewData.map((part: any) => (
                        <tr key={part._id} className="hover:bg-white/[0.02] transition-colors font-mono text-xs">
                          <td className="!pl-6 font-bold text-white uppercase">{part.partNumber}</td>
                          <td className="font-sans font-medium text-white">{part.partName}</td>
                          <td>
                            <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] border border-white/10 font-sans">
                              {part.category}
                            </span>
                          </td>
                          <td>${Number(part.unitCost || 0).toFixed(2)}</td>
                          <td className="font-bold text-white">{part.quantityOnHand} {part.unit}</td>
                          <td className="text-gray-400">{part.quantityReserved || 0}</td>
                          <td>
                            {part.isBlocked ? (
                              <span className="text-red-400 font-bold flex items-center gap-1">
                                <Lock size={12} /> Code Blocked
                              </span>
                            ) : part.quantityBlocked > 0 ? (
                              <span className="text-amber-400 font-bold flex items-center gap-1">
                                <ShieldAlert size={12} /> {part.quantityBlocked} Blocked
                              </span>
                            ) : (
                              <span className="text-gray-500">0</span>
                            )}
                          </td>
                          <td className="font-bold text-lime">
                            {part.quantityAvailable} {part.unit}
                          </td>
                          <td className="text-center font-sans">
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                              part.isBlocked ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              (part.quantityAvailable <= 0 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')
                            }`}>
                              {part.statusText}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: SPARE PARTS CONSUMPTION REPORTS ── */}
        {activeTab === 'CONSUMPTION_REPORT' && (
          <div className="space-y-6">
            <div className="glass-card p-6 space-y-6 border border-[var(--border-main)]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-main)]/30 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="text-lime" size={20} /> Spare Parts Consumption Reports
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Generate and download consumption reports on a Daily, Weekly, Monthly, Half-Yearly, and Yearly basis. Filterable by single code, multiple codes, or all items.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleFetchConsumptionReport}
                    disabled={consumptionReportLoading}
                    className="btn-secondary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5"
                  >
                    {consumptionReportLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Generate Report
                  </button>
                  <button
                    type="button"
                    onClick={handleExportConsumptionExcel}
                    disabled={!consumptionReport || !consumptionReport.data || consumptionReport.data.length === 0}
                    className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={14} /> Download Excel (.xlsx)
                  </button>
                </div>
              </div>

              {/* Filters Form */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Period Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    <Calendar size={12} className="text-lime" /> Report Period
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['daily', 'weekly', 'monthly', 'half-yearly', 'yearly'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setReportPeriod(p)}
                        className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer text-center ${
                          reportPeriod === p
                            ? 'bg-lime text-black border border-lime shadow'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        {p.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filter Mode Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Item Code Filter Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReportFilterMode('ALL')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer text-center ${
                        reportFilterMode === 'ALL'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      All Items (Without Code)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportFilterMode('SINGLE')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer text-center ${
                        reportFilterMode === 'SINGLE'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      Single Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportFilterMode('MULTI')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer text-center ${
                        reportFilterMode === 'MULTI'
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      Multiple Codes
                    </button>
                  </div>
                </div>

                {/* Codes Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {reportFilterMode === 'ALL' ? 'Material Filter' : reportFilterMode === 'SINGLE' ? 'Single Item Code' : 'Multiple Item Codes'}
                  </label>
                  <input
                    type="text"
                    disabled={reportFilterMode === 'ALL'}
                    value={reportItemCodes}
                    onChange={(e) => setReportItemCodes(e.target.value)}
                    placeholder={reportFilterMode === 'ALL' ? 'Viewing all spare parts' : reportFilterMode === 'SINGLE' ? 'E.g. SP-1002-PT' : 'E.g. SP-1002-PT, EO-5W30-4L'}
                    className="input-field text-xs font-mono disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Report Summary Cards */}
            {consumptionReport && consumptionReport.summary && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="stat-card p-4 border-l-4 border-l-lime">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Unique Spare Parts Consumed</span>
                  <p className="text-3xl font-extrabold text-white mt-1">{consumptionReport.summary.totalPartsCount}</p>
                </div>
                <div className="stat-card p-4 border-l-4 border-l-blue-500">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Quantity Issued/Consumed</span>
                  <p className="text-3xl font-extrabold text-white mt-1">{consumptionReport.summary.totalQuantityConsumed} units</p>
                </div>
                <div className="stat-card p-4 border-l-4 border-l-purple-500">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Consumption Value ($)</span>
                  <p className="text-3xl font-extrabold text-lime mt-1">${Number(consumptionReport.summary.totalConsumptionCost || 0).toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Consumption Report Table */}
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="!pl-6">Part Code</th>
                      <th>Part Name</th>
                      <th>Category</th>
                      <th>Unit Cost</th>
                      <th>Total Qty Consumed</th>
                      <th>Total Consumption Cost ($)</th>
                      <th className="text-right !pr-6">Work Order Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!consumptionReport || !consumptionReport.data || consumptionReport.data.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center opacity-40">
                          <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-500" />
                          <p>No consumption transactions recorded for the selected period & filters.</p>
                        </td>
                      </tr>
                    ) : (
                      consumptionReport.data.map((item: any) => (
                        <tr key={item.partId} className="hover:bg-white/[0.02] transition-colors font-mono text-xs">
                          <td className="!pl-6 font-bold text-white uppercase">{item.partNumber}</td>
                          <td className="font-sans font-bold text-white">{item.partName}</td>
                          <td>
                            <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-sans">
                              {item.category}
                            </span>
                          </td>
                          <td>${Number(item.unitCost || 0).toFixed(2)}</td>
                          <td className="font-bold text-amber-400">{item.totalQuantity} {item.unit}(s)</td>
                          <td className="font-bold text-lime">${Number(item.totalCost || 0).toFixed(2)}</td>
                          <td className="!pr-6 text-right font-sans">
                            <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white font-mono font-bold">
                              {item.transactions?.length || 0} issue event(s)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ── */}

      {/* Block Stock Modal */}
      {showBlockModal && selectedPart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-md p-6 space-y-6 shadow-2xl relative border border-[var(--border-main)] rounded-3xl">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                  <ShieldAlert className="text-red-500" size={22} />
                  Manage Material Stock Block
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedPart.partName} ({selectedPart.partNumber})</p>
              </div>
              <button
                onClick={() => setShowBlockModal(false)}
                className="p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 text-left text-xs">
              {/* Option 1: Full Material Code Block */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="font-bold text-white block">Block Material Code (Full Stock)</label>
                    <p className="text-[10px] text-gray-400 leading-normal">Completely prevents this part from being issued or consumed on any Work Order.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={blockForm.isBlocked}
                    onChange={(e) => setBlockForm({ ...blockForm, isBlocked: e.target.checked })}
                    className="w-5 h-5 accent-red-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Option 2: Partial Quantity Block */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <label className="font-bold text-white block">Partial Blocked Quantity ({selectedPart.unit})</label>
                <p className="text-[10px] text-gray-400 leading-normal">
                  Blocks only a specific quantity while allowing the remaining stock ({Math.max(0, selectedPart.quantityOnHand - (selectedPart.quantityReserved || 0))} available) to be issued normally.
                </p>
                <input
                  type="number"
                  min="0"
                  max={selectedPart.quantityOnHand}
                  disabled={blockForm.isBlocked}
                  value={blockForm.quantityBlocked}
                  onChange={(e) => setBlockForm({ ...blockForm, quantityBlocked: Number(e.target.value) })}
                  className="input-field text-sm font-bold w-full disabled:opacity-40"
                />
              </div>

              {/* Block Reason */}
              <div className="space-y-1.5">
                <label className="font-bold text-gray-300 block uppercase text-[10px]">Reason for Blocking</label>
                <input
                  type="text"
                  placeholder="E.g. Quality inspection pending, damaged batch, reserved for audit..."
                  value={blockForm.blockedReason}
                  onChange={(e) => setBlockForm({ ...blockForm, blockedReason: e.target.value })}
                  className="input-field text-xs w-full"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-[var(--border-main)]">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="btn-secondary flex-1 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveBlock}
                  className="btn-primary flex-1 font-bold flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  Save Block Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-2xl p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto relative border border-[var(--border-main)] rounded-[2.5rem]">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <Package className="text-[var(--brand-lime)]" size={24} />
                  Bulk Excel Upload
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">Upload parts in bulk using an Excel spreadsheet</p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-3 hover:bg-[var(--bg-input)] rounded-2xl transition-all border border-[var(--border-main)]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-5 bg-white/[0.01] border border-[var(--border-main)] rounded-3xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-main)' }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Need an Excel Template?
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Download our sample sheet, populate it, and upload it here.</p>
                </div>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="btn-secondary !py-2.5 !px-4 !rounded-2xl flex items-center gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                >
                  <ArrowUpRight size={16} /> Template
                </button>
              </div>

              <div className="p-8 border-2 border-dashed border-[var(--border-main)] hover:border-[var(--brand-lime)]/50 rounded-3xl text-center space-y-4 transition-all duration-300 bg-white/[0.005] group">
                <div className="w-16 h-16 bg-[var(--brand-lime-alpha)] rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                  <Upload size={28} className="text-[var(--brand-lime)]" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>Choose Excel spreadsheet</p>
                  <p className="text-xs text-[var(--text-muted)]">Supports .xlsx and .xls formats</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="mx-auto block text-sm file:mr-4 file:py-2.5 file:px-5 file:rounded-2xl file:border-0 file:text-xs file:font-bold file:bg-[var(--brand-lime)] file:text-black hover:file:opacity-90 file:cursor-pointer transition-colors"
                />
              </div>

              {bulkErrors.length > 0 && (
                <div className="p-4 bg-red-500/5 border border-red-500/15 rounded-3xl space-y-2 animate-fadeInUp">
                  <p className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Validation Issues Found ({bulkErrors.length})
                  </p>
                  <div className="max-h-36 overflow-y-auto text-xs text-red-400/80 list-disc pl-4 space-y-1 font-mono">
                    {bulkErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </div>
                </div>
              )}

              {bulkData.length > 0 && (
                <div className="space-y-3 animate-fadeInUp">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-dim)]">Preview ({bulkData.length} valid parts)</p>
                    <span className="text-[10px] bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] px-2 py-0.5 rounded font-bold">Ready</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-[var(--border-main)] rounded-2xl overflow-hidden shadow-inner">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--bg-input)] sticky top-0 border-b border-[var(--border-main)]">
                        <tr>
                          <th className="p-3 font-semibold uppercase tracking-wider opacity-60">Part Name</th>
                          <th className="p-3 font-semibold uppercase tracking-wider opacity-60">Part Number</th>
                          <th className="p-3 font-semibold uppercase tracking-wider opacity-60">Category</th>
                          <th className="p-3 font-semibold uppercase tracking-wider opacity-60 text-right">Selling Price</th>
                          <th className="p-3 font-semibold uppercase tracking-wider opacity-60 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkData.map((part, i) => (
                          <tr key={i} className="border-b border-[var(--border-main)] hover:bg-white/[0.01] transition-colors">
                            <td className="p-3 truncate max-w-[150px] font-medium" style={{ color: 'var(--text-main)' }}>{part.partName}</td>
                            <td className="p-3 font-mono opacity-80 uppercase">{part.partNumber}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-[var(--bg-input)] text-[10px] font-medium border border-[var(--border-main)]">{part.category}</span>
                            </td>
                            <td className="p-3 text-right font-mono">${part.unitCost?.toFixed(2) || '0.00'}</td>
                            <td className="p-3 text-right font-mono font-bold text-[var(--brand-lime)]">{part.quantityOnHand}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4 border-t border-[var(--border-main)]">
                <button
                  type="button"
                  className="btn-secondary flex-1 !rounded-2xl !py-3 font-bold"
                  onClick={() => setShowBulkModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1 !rounded-2xl !py-3 font-bold"
                  disabled={submitting || bulkData.length === 0}
                  onClick={handleBulkSubmit}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin mx-auto" /> : `Import ${bulkData.length} Parts`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {showRestockModal && selectedPart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-sm p-6 space-y-6 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
              <ShoppingCart size={32} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Create Purchase Request</h2>
              <p className="text-sm opacity-60 mt-1">{selectedPart.partName}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 ml-1">Quantity Requested ({selectedPart.unit})</label>
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
                  className="btn-primary flex-1"
                  disabled={submitting || restockQty < 1}
                  onClick={handleRestock}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Inventory;
