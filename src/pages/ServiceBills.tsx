import React, { useEffect, useState, useRef } from 'react';
import { 
  Receipt, Search, Filter, Eye, DollarSign, X, Check, CheckCircle2, 
  Clock, AlertCircle, AlertTriangle, ArrowUpRight, MoreHorizontal, ChevronDown,
  FileText, Loader2, User, Phone, Edit3, Plus, Trash2, Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getBills, getBillById, approveBill, updateBill, getTaxProfiles, voidBill,
  type ServiceBill, type BillStatus, type PaymentStatus 
} from '../services/serviceBillService';
import { format } from 'date-fns';
import { getBillingDrivers, type BillingDriver } from '../services/workOrderService';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  PENDING_APPROVAL: 'orange',
  APPROVED: 'blue',
  PAID: 'green',
  VOID: 'red'
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'red',
  PARTIAL: 'orange',
  PAID: 'green'
};

const ServiceBills: React.FC = () => {
  const [bills, setBills] = useState<ServiceBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<'all' | 'driver' | 'workshop'>('all');
  
  const [selectedBill, setSelectedBill] = useState<ServiceBill | null>(null);
  const [billToApprove, setBillToApprove] = useState<ServiceBill | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBill, setEditingBill] = useState<ServiceBill | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [billingDrivers, setBillingDrivers] = useState<BillingDriver[]>([]);
  const [taxProfiles, setTaxProfiles] = useState<any[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [isDriverDropdownOpen, setIsDriverDropdownOpen] = useState(false);
  const driverDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (driverDropdownRef.current && !driverDropdownRef.current.contains(event.target as Node)) {
        setIsDriverDropdownOpen(false);
      }
    };
    if (isDriverDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDriverDropdownOpen]);

  const [editForm, setEditForm] = useState<{
    isDriverBilled: boolean;
    driverId: string;
    customerId: string;
    taxRate: number;
    taxName: string;
    taxProfileId: string;
    discount: number;
    notes: string;
    lineItems: {
      type: 'LABOUR' | 'PART' | 'MISC';
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  }>({
    isDriverBilled: false,
    driverId: '',
    customerId: '',
    taxRate: 7,
    taxName: 'ITBMS',
    taxProfileId: '',
    discount: 0,
    notes: '',
    lineItems: []
  });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [kpiFilter, setKpiFilter] = useState<'ALL' | 'INVOICED' | 'NOT_INVOICED' | 'INVOICED_OLA' | 'PENDING_OLA' | 'INVOICED_CLIENT' | 'PENDING_CLIENT' | 'GATEPASS'>('ALL');

  // KPI Aggregations
  const totalInvoicesCount = bills.filter(b => b.status === 'APPROVED' || b.status === 'PAID').length;
  const totalInvoicesAmount = bills.filter(b => b.status === 'APPROVED' || b.status === 'PAID').reduce((sum, b) => sum + b.totalAmount, 0);

  const notInvoicedCount = bills.filter(b => b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL').length;
  const notInvoicedAmount = bills.filter(b => b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL').reduce((sum, b) => sum + b.totalAmount, 0);

  const invoicedOlaCount = bills.filter(b => !b.isDriverBilled && (b.status === 'APPROVED' || b.status === 'PAID')).length;
  const invoicedOlaAmount = bills.filter(b => !b.isDriverBilled && (b.status === 'APPROVED' || b.status === 'PAID')).reduce((sum, b) => sum + b.totalAmount, 0);

  const pendingOlaCount = bills.filter(b => !b.isDriverBilled && (b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL')).length;
  const pendingOlaAmount = bills.filter(b => !b.isDriverBilled && (b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL')).reduce((sum, b) => sum + b.totalAmount, 0);

  const invoicedClientCount = bills.filter(b => b.isDriverBilled && (b.status === 'APPROVED' || b.status === 'PAID')).length;
  const invoicedClientAmount = bills.filter(b => b.isDriverBilled && (b.status === 'APPROVED' || b.status === 'PAID')).reduce((sum, b) => sum + b.totalAmount, 0);

  const pendingClientCount = bills.filter(b => b.isDriverBilled && (b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL')).length;
  const pendingClientAmount = bills.filter(b => b.isDriverBilled && (b.status === 'DRAFT' || b.status === 'PENDING_APPROVAL')).reduce((sum, b) => sum + b.totalAmount, 0);

  const gatepassCount = bills.filter(b => ['VEHICLE_RELEASED', 'CLOSED', 'READY_FOR_RELEASE'].includes(b.workOrderId?.status || '')).length;

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      setLoading(true);
      const data = await getBills();
      setBills(data);
    } catch (error) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = async (bill: ServiceBill) => {
    setEditingBill(bill);
    const dId = typeof bill.driverId === 'object' && bill.driverId?._id ? bill.driverId._id : (bill.driverId || '');
    const cId = typeof bill.customerId === 'object' && bill.customerId?._id ? bill.customerId._id : (bill.customerId || '');

    setEditForm({
      isDriverBilled: !!bill.isDriverBilled,
      driverId: dId,
      customerId: cId,
      taxRate: bill.taxRate ?? 7,
      taxName: (bill as any).taxName || 'ITBMS',
      taxProfileId: (bill as any).taxProfileId || '',
      discount: bill.discount || 0,
      notes: (bill as any).notes || '',
      lineItems: (bill.lineItems || []).map(item => ({
        type: item.type || 'PART',
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || Math.round((item.quantity || 1) * (item.unitPrice || 0) * 100) / 100
      }))
    });
    setShowEditModal(true);
    setDriverSearchQuery('');
    setIsDriverDropdownOpen(false);

    if (billingDrivers.length === 0) {
      try {
        const [drivers, taxes] = await Promise.all([
          getBillingDrivers(),
          getTaxProfiles()
        ]);
        setBillingDrivers(drivers || []);
        setTaxProfiles(taxes || []);
      } catch (err) {
        console.error('Failed to load drivers/tax profiles for edit modal', err);
      }
    }
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    setEditForm(prev => {
      const updatedItems = [...prev.lineItems];
      const currentItem = { ...updatedItems[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Math.max(0, Number(value) || 0) : currentItem.quantity;
        const price = field === 'unitPrice' ? Math.max(0, Number(value) || 0) : currentItem.unitPrice;
        currentItem.lineTotal = Math.round(qty * price * 100) / 100;
      }
      updatedItems[index] = currentItem;
      return { ...prev, lineItems: updatedItems };
    });
  };

  const handleAddLineItem = () => {
    setEditForm(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { type: 'PART', description: '', quantity: 1, unitPrice: 0, lineTotal: 0 }
      ]
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    if (editForm.lineItems.length <= 1) {
      toast.error('At least one bill item is required');
      return;
    }
    setEditForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }));
  };

  const handleDriverChange = (driverId: string) => {
    const selectedDriver = billingDrivers.find(d => d._id === driverId);
    setEditForm(prev => ({
      ...prev,
      driverId,
      customerId: selectedDriver?.customer?._id || ''
    }));
  };

  const handleSaveEdit = async () => {
    if (!editingBill) return;

    if (editForm.lineItems.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    for (let i = 0; i < editForm.lineItems.length; i++) {
      const it = editForm.lineItems[i];
      if (!it.description?.trim()) {
        toast.error(`Item #${i + 1} must have a description`);
        return;
      }
      if (it.quantity <= 0) {
        toast.error(`Item #${i + 1} quantity must be greater than 0`);
        return;
      }
      if (it.unitPrice < 0) {
        toast.error(`Item #${i + 1} unit price cannot be negative`);
        return;
      }
    }

    if (editForm.isDriverBilled && !editForm.driverId) {
      toast.error('Please select a driver for driver billing');
      return;
    }

    try {
      setIsSavingEdit(true);
      const updated = await updateBill(editingBill._id, editForm);
      toast.success('Bill updated successfully');
      loadBills();
      if (selectedBill?._id === editingBill._id) {
        setSelectedBill(updated);
      }
      setShowEditModal(false);
      setEditingBill(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update bill');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const editSubtotal = editForm.lineItems.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0);
  const editDiscount = Math.min(Number(editForm.discount) || 0, editSubtotal);
  const editTaxable = Math.max(0, editSubtotal - editDiscount);
  const editTaxAmount = Math.round(editTaxable * ((Number(editForm.taxRate) || 0) / 100) * 100) / 100;
  const editTotalAmount = Math.round((editTaxable + editTaxAmount) * 100) / 100;

  const handleConfirmApprove = async () => {
    if (!billToApprove) return;
    try {
      setIsApproving(true);
      const updated = await approveBill(billToApprove._id);
      if (updated.invoiceNumber) {
        toast.success(
          <div>
            <p className="font-bold">Bill Approved Successfully</p>
            <p className="text-[10px] opacity-80 mt-0.5">Invoice <span className="text-brand-lime">{updated.invoiceNumber}</span> Linked Successfully</p>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.success('Bill approved successfully');
      }
      loadBills();
      if (selectedBill?._id === billToApprove._id) {
        setSelectedBill(updated);
      }
      setBillToApprove(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve bill');
    } finally {
      setIsApproving(false);
    }
  };

  const filteredBills = bills.filter(bill => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
                         bill.billNumber.toLowerCase().includes(searchLower) ||
                         (bill.workOrderId?.workOrderNumber || '').toLowerCase().includes(searchLower);
    
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    
    let matchesBillingType = true;
    if (billingTypeFilter === 'driver') matchesBillingType = bill.isDriverBilled === true;
    if (billingTypeFilter === 'workshop') matchesBillingType = !bill.isDriverBilled;

    // Apply KPI filter overrides
    if (kpiFilter === 'INVOICED') {
      if (!(bill.status === 'APPROVED' || bill.status === 'PAID')) return false;
    } else if (kpiFilter === 'NOT_INVOICED') {
      if (!(bill.status === 'DRAFT' || bill.status === 'PENDING_APPROVAL')) return false;
    } else if (kpiFilter === 'INVOICED_OLA') {
      if (bill.isDriverBilled || !(bill.status === 'APPROVED' || bill.status === 'PAID')) return false;
    } else if (kpiFilter === 'PENDING_OLA') {
      if (bill.isDriverBilled || !(bill.status === 'DRAFT' || bill.status === 'PENDING_APPROVAL')) return false;
    } else if (kpiFilter === 'INVOICED_CLIENT') {
      if (!bill.isDriverBilled || !(bill.status === 'APPROVED' || bill.status === 'PAID')) return false;
    } else if (kpiFilter === 'PENDING_CLIENT') {
      if (!bill.isDriverBilled || !(bill.status === 'DRAFT' || bill.status === 'PENDING_APPROVAL')) return false;
    } else if (kpiFilter === 'GATEPASS') {
      const woStatus = bill.workOrderId?.status || '';
      if (!['VEHICLE_RELEASED', 'CLOSED', 'READY_FOR_RELEASE'].includes(woStatus)) return false;
    }

    return matchesSearch && matchesStatus && matchesBillingType;
  });

  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, billingTypeFilter, kpiFilter]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="text-[var(--brand-lime)]" /> Service Bills
          </h1>
          <p className="text-sm opacity-60">Manage workshop invoices and payments</p>
        </div>
      </div>

      {/* Stats Dashboard - Grouped Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Invoice Overview & Gatepasses */}
        <div className="stat-card p-5 flex flex-col justify-between" style={{ borderColor: 'rgba(200, 230, 0, 0.25)' }}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-lime" style={{ color: 'var(--brand-lime)' }}>
                Billing Overview
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(200,230,0,0.1)]">
                <Receipt size={18} style={{ color: 'var(--brand-lime)' }} />
              </div>
            </div>

            <div className="space-y-3">
              {/* Total Invoice */}
              <div className={`p-2.5 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'INVOICED' ? 'bg-white/5 border-[var(--brand-lime)]' : 'border-transparent hover:bg-white/5'}`}
                onClick={() => setKpiFilter(prev => prev === 'INVOICED' ? 'ALL' : 'INVOICED')}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--brand-lime)]" />
                    Total Invoice (Approved/Paid)
                  </span>
                  <span className="font-bold text-white">{totalInvoicesCount}</span>
                </div>
                <div className="text-right text-[10px] text-gray-400 font-mono">${totalInvoicesAmount.toLocaleString()}</div>
              </div>

              {/* Not Invoiced */}
              <div className={`p-2.5 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'NOT_INVOICED' ? 'bg-white/5 border-[#E67E22]' : 'border-transparent hover:bg-white/5'}`}
                onClick={() => setKpiFilter(prev => prev === 'NOT_INVOICED' ? 'ALL' : 'NOT_INVOICED')}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#E67E22]" />
                    Not Invoiced (Draft/Pending)
                  </span>
                  <span className="font-bold text-white">{notInvoicedCount}</span>
                </div>
                <div className="text-right text-[10px] text-gray-400 font-mono">${notInvoicedAmount.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[var(--border-main)] flex items-center justify-between">
            <div className={`flex-1 p-2 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'GATEPASS' ? 'bg-white/5 border-[var(--brand-lime)]' : 'border-transparent hover:bg-white/5'}`}
              onClick={() => setKpiFilter(prev => prev === 'GATEPASS' ? 'ALL' : 'GATEPASS')}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--brand-lime)]" />
                  Total Gatepass Issued
                </span>
                <span className="font-bold text-white">{gatepassCount} <span className="text-[10px] font-normal text-gray-400">vehicles</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Ola Cars Invoicing Status */}
        <div className="stat-card p-5 flex flex-col justify-between" style={{ borderColor: 'rgba(230, 126, 34, 0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Ola Cars Invoicing</span>
            <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Internal</span>
          </div>

          <div className="space-y-4 my-auto">
            {/* Invoiced to Ola Cars */}
            <div className={`p-3 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'INVOICED_OLA' ? 'bg-white/5 border-[#F39C12]' : 'border-transparent hover:bg-white/5'}`}
              onClick={() => setKpiFilter(prev => prev === 'INVOICED_OLA' ? 'ALL' : 'INVOICED_OLA')}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F39C12]" />
                  Invoiced to Ola Cars
                </span>
                <span className="font-bold text-white">{invoicedOlaCount}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>Workshop Billed</span>
                <span>${invoicedOlaAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Pending Invoice to Ola Cars */}
            <div className={`p-3 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'PENDING_OLA' ? 'bg-white/5 border-[#EF4444]' : 'border-transparent hover:bg-white/5'}`}
              onClick={() => setKpiFilter(prev => prev === 'PENDING_OLA' ? 'ALL' : 'PENDING_OLA')}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                  Pending Invoice to Ola Cars
                </span>
                <span className="font-bold text-white">{pendingOlaCount}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>Pending Approval</span>
                <span>${pendingOlaAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Client/Driver Invoicing Status */}
        <div className="stat-card p-5 flex flex-col justify-between" style={{ borderColor: 'rgba(155, 89, 182, 0.25)' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Client / Driver Invoicing</span>
            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">External</span>
          </div>

          <div className="space-y-4 my-auto">
            {/* Invoiced to Client */}
            <div className={`p-3 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'INVOICED_CLIENT' ? 'bg-white/5 border-[#F39C12]' : 'border-transparent hover:bg-white/5'}`}
              onClick={() => setKpiFilter(prev => prev === 'INVOICED_CLIENT' ? 'ALL' : 'INVOICED_CLIENT')}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F39C12]" style={{ backgroundColor: 'rgb(244, 164, 96)' }} />
                  Invoiced to Client
                </span>
                <span className="font-bold text-white">{invoicedClientCount}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>Driver Billed</span>
                <span>${invoicedClientAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Pending Invoice to Client */}
            <div className={`p-3 rounded-xl border transition-all cursor-pointer ${kpiFilter === 'PENDING_CLIENT' ? 'bg-white/5 border-[#9B59B6]' : 'border-transparent hover:bg-white/5'}`}
              onClick={() => setKpiFilter(prev => prev === 'PENDING_CLIENT' ? 'ALL' : 'PENDING_CLIENT')}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#9B59B6]" />
                  Pending Invoice to Clients
                </span>
                <span className="font-bold text-white">{pendingClientCount}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>Pending Payment / Approval</span>
                <span>${pendingClientAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={18} />
          <input
            type="text"
            placeholder="Search by Bill # or WO #..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl focus:outline-none focus:border-[var(--brand-lime)] transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={18} />
          <select
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl focus:outline-none appearance-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={18} />
        </div>
        <div className="relative">
          <Receipt className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={18} />
          <select
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl focus:outline-none appearance-none"
            value={billingTypeFilter}
            onChange={(e) => setBillingTypeFilter(e.target.value as any)}
          >
            <option value="all">All Billing</option>
            <option value="driver">Driver Billed</option>
            <option value="workshop">Workshop Billed</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={18} />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-input)] opacity-60 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Bill Info</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Total Amount</th>
                <th className="px-6 py-4 font-semibold text-right">Paid</th>
                <th className="px-6 py-4 font-semibold text-right text-[var(--brand-lime)]">Balance</th>
                <th className="px-6 py-4 font-semibold">Payment Status</th>
                <th className="px-6 py-4 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-main)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto opacity-20" />
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center opacity-40 text-sm">No bills found</td>
                </tr>
              ) : paginatedBills.map((bill) => (
                <tr key={bill._id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm">{bill.billNumber}</div>
                    <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                      <FileText size={10} /> WO: {bill.workOrderId?.workOrderNumber || 'N/A'}
                    </div>
                    {bill.isDriverBilled && (
                      <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)] text-[8px] font-bold uppercase tracking-wider">
                        <User size={9} />
                        Driver Billed{bill.driverId?.personalInfo?.fullName || bill.driverId?.fullName ? `: ${bill.driverId?.personalInfo?.fullName || bill.driverId?.fullName}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-${STATUS_COLORS[bill.status]}-500/10 text-${STATUS_COLORS[bill.status]}-500 border border-${STATUS_COLORS[bill.status]}-500/20`}>
                      {bill.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-sm">
                    ${bill.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm opacity-80">
                    ${(bill.amountPaid || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-[var(--brand-lime)]">
                    ${(bill.totalAmount - (bill.amountPaid || 0)).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full bg-${PAYMENT_STATUS_COLORS[bill.paymentStatus]}-500`}></div>
                      <span className="text-xs font-medium">{bill.paymentStatus}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => { setSelectedBill(bill); setShowDetailModal(true); }}
                        className="p-2 hover:bg-[var(--bg-input)] rounded-lg transition-colors text-[var(--brand-lime)]"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      {bill.status === 'DRAFT' && (
                        <button 
                          onClick={() => setBillToApprove(bill)}
                          className="p-2 hover:bg-[var(--bg-input)] rounded-lg transition-colors text-blue-500"
                          title="Approve Bill"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[var(--border-main)] flex items-center justify-between bg-white/5">
            <p className="text-xs text-[var(--text-muted)]">
              Showing <span className="font-bold text-[var(--text-main)]">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-[var(--text-main)]">{Math.min(currentPage * itemsPerPage, filteredBills.length)}</span> of <span className="font-bold text-[var(--text-main)]">{filteredBills.length}</span> bills
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-main)] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-[var(--brand-lime)] text-black' : 'hover:bg-white/5 border border-transparent hover:border-[var(--border-main)] text-[var(--text-muted)]'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-main)] text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bill Detail Modal */}
      {showDetailModal && selectedBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card w-full max-w-4xl p-0 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-input)]">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Receipt size={24} className="text-[var(--brand-lime)]" /> {selectedBill.billNumber}
                </h2>
                <p className="text-xs opacity-60">Generated on {format(new Date(selectedBill.createdAt), 'PPP')}</p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest mb-1">Status</p>
                  <p className="font-bold text-sm">{selectedBill.status}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest mb-1">Payment Status</p>
                  <p className="font-bold text-sm">{selectedBill.paymentStatus}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] opacity-60 uppercase font-bold tracking-widest mb-1">Work Order</p>
                  <p className="font-bold text-sm">{selectedBill.workOrderId?.workOrderNumber || 'N/A'}</p>
                </div>
              </div>

              {selectedBill.isDriverBilled && (
                <div className="p-4 bg-[var(--brand-lime-alpha)]/10 rounded-2xl border border-[var(--brand-lime-alpha)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--brand-lime)] text-black flex items-center justify-center font-bold shrink-0">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-lime)]">
                          Driver Billed
                        </span>
                        {selectedBill.driverId?.driverId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-gray-300">
                            {selectedBill.driverId.driverId}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-white">
                        {selectedBill.driverId?.personalInfo?.fullName || selectedBill.driverId?.fullName || (typeof selectedBill.driverId === 'string' ? selectedBill.driverId : 'Assigned Driver')}
                      </p>
                      {selectedBill.driverId?.phone && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> {selectedBill.driverId.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedBill.customerId && (
                    <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Customer Billing Account</span>
                      <p className="text-xs font-semibold text-white">
                        {selectedBill.customerId?.name || 'Linked Account'}
                      </p>
                      {selectedBill.customerId?.customerId && (
                        <span className="text-[10px] font-mono text-gray-400">
                          ID: {selectedBill.customerId.customerId}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={16} /> Bill Items
                </h3>
                <div className="border border-[var(--border-main)] rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="p-3">Description</th>
                        <th className="p-3">Type</th>
                        <th className="p-3 text-center">Qty</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-main)]">
                      {selectedBill.lineItems.map((item, i) => (
                        <tr key={i}>
                          <td className="p-3">{item.description}</td>
                          <td className="p-3"><span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded uppercase font-bold">{item.type}</span></td>
                          <td className="p-3 text-center">{item.quantity}</td>
                          <td className="p-3 text-right">${item.unitPrice.toLocaleString()}</td>
                          <td className="p-3 text-right font-bold">${item.lineTotal.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-white/5 font-bold">
                      <tr className="border-t-2 border-[var(--border-main)]">
                        <td colSpan={4} className="p-3 text-right opacity-60">Subtotal</td>
                        <td className="p-3 text-right">${selectedBill.subtotal.toLocaleString()}</td>
                      </tr>
                      {selectedBill.taxAmount > 0 && (
                        <tr>
                          <td colSpan={4} className="p-3 text-right opacity-60">Tax ({selectedBill.taxRate}%)</td>
                          <td className="p-3 text-right text-orange-400">+${selectedBill.taxAmount.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedBill.discount > 0 && (
                        <tr>
                          <td colSpan={4} className="p-3 text-right opacity-60">Discount</td>
                          <td className="p-3 text-right text-green-400">-${selectedBill.discount.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="text-lg bg-white/10">
                        <td colSpan={4} className="p-3 text-right">Total Amount</td>
                        <td className="p-3 text-right">${selectedBill.totalAmount.toLocaleString()}</td>
                      </tr>
                      {selectedBill.amountPaid > 0 && (
                        <tr className="text-green-400 bg-green-400/5">
                          <td colSpan={4} className="p-3 text-right opacity-60 uppercase text-[10px] tracking-widest">Amount Paid</td>
                          <td className="p-3 text-right">-${selectedBill.amountPaid.toLocaleString()}</td>
                        </tr>
                      )}
                      {selectedBill.totalAmount - selectedBill.amountPaid > 0 && (
                        <tr className="text-lg bg-[var(--brand-lime)] text-black">
                          <td colSpan={4} className="p-3 text-right uppercase text-xs tracking-widest">Balance Due</td>
                          <td className="p-3 text-right">${(selectedBill.totalAmount - selectedBill.amountPaid).toLocaleString()}</td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>

              {selectedBill.payments.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold opacity-60 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign size={16} /> Payment History
                  </h3>
                  <div className="space-y-2">
                    {selectedBill.payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                            <DollarSign size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">${p.amount.toLocaleString()}</p>
                            <p className="text-[10px] opacity-60">{p.paymentMethod} • {format(new Date(p.paidAt), 'PPp')}</p>
                          </div>
                        </div>
                        {p.paymentReference && (
                          <span className="text-[10px] opacity-40 font-mono">Ref: {p.paymentReference}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--border-main)] flex gap-4 bg-[var(--bg-input)]">
              {selectedBill.status === 'DRAFT' && (
                <>
                  <button 
                    onClick={() => handleOpenEditModal(selectedBill)}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  >
                    <Edit3 size={16} />
                    Edit Bill
                  </button>
                  <button 
                    onClick={() => setBillToApprove(selectedBill)}
                    className="flex-1 btn-primary"
                  >
                    Approve Bill
                  </button>
                </>
              )}
              <button 
                onClick={() => setShowDetailModal(false)}
                className="flex-1 btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* Edit Bill Modal */}
      {showEditModal && editingBill && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-4xl p-0 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-white/10 rounded-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-input)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Edit Service Bill <span className="text-[var(--brand-lime)] font-mono">{editingBill.billNumber}</span>
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Modify billing party, line items, and financial values before final approval
                  </p>
                </div>
              </div>
              <button 
                onClick={() => !isSavingEdit && setShowEditModal(false)}
                disabled={isSavingEdit}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-[var(--text-muted)] hover:text-white disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Billing Party Section */}
              <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 flex items-center gap-2">
                    <User size={15} className="text-[var(--brand-lime)]" /> Billing Assignment
                  </h3>
                  <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, isDriverBilled: false }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!editForm.isDriverBilled ? 'bg-[var(--brand-lime)] text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      Workshop Billed
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, isDriverBilled: true }))}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${editForm.isDriverBilled ? 'bg-[var(--brand-lime)] text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                      Driver Billed
                    </button>
                  </div>
                </div>

                {editForm.isDriverBilled ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div className="relative" ref={driverDropdownRef}>
                      <label className="text-xs font-bold text-gray-300 flex items-center justify-between mb-1.5">
                        <span>Select Driver <span className="text-red-400">*</span></span>
                        {editForm.driverId && (() => {
                          const curr = billingDrivers.find(d => d._id === editForm.driverId);
                          return curr?.driverId ? (
                            <span className="text-[10px] text-[var(--brand-lime)] font-mono">
                              ID: {curr.driverId}
                            </span>
                          ) : null;
                        })()}
                      </label>

                      {/* Dropdown Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setIsDriverDropdownOpen(prev => !prev)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isDriverDropdownOpen
                            ? 'border-[var(--brand-lime)] ring-1 ring-[var(--brand-lime)] bg-black/60'
                            : 'border-[var(--border-main)] bg-[var(--bg-input)] hover:border-white/30'
                        }`}
                      >
                        {(() => {
                          const curr = billingDrivers.find(d => d._id === editForm.driverId);
                          if (curr) {
                            return (
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[var(--brand-lime)] text-black flex items-center justify-center font-bold text-xs shrink-0">
                                  {(curr.fullName || 'D').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-white truncate">{curr.fullName}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-[var(--brand-lime)] border border-[var(--brand-lime)]/30">
                                      {curr.driverId}
                                    </span>
                                  </div>
                                  {curr.phone && (
                                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                      <Phone size={10} /> {curr.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                              <User size={16} className="opacity-60" />
                              <span>Click to search and select a driver...</span>
                            </div>
                          );
                        })()}
                        <ChevronDown
                          size={18}
                          className={`text-gray-400 shrink-0 transition-transform duration-200 ${
                            isDriverDropdownOpen ? 'rotate-180 text-[var(--brand-lime)]' : ''
                          }`}
                        />
                      </button>

                      {/* Searchable Dropdown Overlay */}
                      {isDriverDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#141414] border border-[var(--border-main)] shadow-2xl p-3 space-y-2.5 backdrop-blur-xl animate-fadeIn">
                          {/* Search Input Box */}
                          <div className="relative">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              autoFocus
                              value={driverSearchQuery}
                              onChange={(e) => setDriverSearchQuery(e.target.value)}
                              placeholder="Search by name, driver ID (OLA-...), phone..."
                              className="w-full pl-9 pr-8 py-2 bg-[var(--bg-input)] border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[var(--brand-lime)]"
                            />
                            {driverSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setDriverSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-0.5"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>

                          {/* Driver Options List */}
                          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {(() => {
                              const q = driverSearchQuery.trim().toLowerCase();
                              const filtered = billingDrivers.filter(d => {
                                if (!q) return true;
                                return (
                                  (d.fullName || '').toLowerCase().includes(q) ||
                                  (d.driverId || '').toLowerCase().includes(q) ||
                                  (d.phone || '').toLowerCase().includes(q) ||
                                  (d.email || '').toLowerCase().includes(q) ||
                                  (d.customer?.name || '').toLowerCase().includes(q) ||
                                  (d.customer?.customerId || '').toLowerCase().includes(q)
                                );
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="py-6 text-center text-xs text-gray-400">
                                    <User size={24} className="mx-auto mb-1.5 opacity-30" />
                                    <p>No drivers found matching <span className="text-white">"{driverSearchQuery}"</span></p>
                                  </div>
                                );
                              }

                              return filtered.map(driver => {
                                const isSelected = editForm.driverId === driver._id;
                                return (
                                  <button
                                    key={driver._id}
                                    type="button"
                                    onClick={() => {
                                      handleDriverChange(driver._id);
                                      setIsDriverDropdownOpen(false);
                                      setDriverSearchQuery('');
                                    }}
                                    className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition-all ${
                                      isSelected
                                        ? 'bg-[var(--brand-lime-alpha)]/20 border border-[var(--brand-lime)]/40 text-white'
                                        : 'hover:bg-white/5 border border-transparent text-gray-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                                          isSelected
                                            ? 'bg-[var(--brand-lime)] text-black'
                                            : 'bg-white/10 text-gray-300'
                                        }`}
                                      >
                                        {(driver.fullName || 'D').substring(0, 2).toUpperCase()}
                                      </div>
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-semibold text-xs text-white truncate">{driver.fullName}</span>
                                          <span className="px-1.5 py-0.2 rounded bg-black/40 text-[9px] font-mono text-[var(--brand-lime)] border border-[var(--brand-lime)]/20">
                                            {driver.driverId}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                                          {driver.phone && (
                                            <span className="flex items-center gap-1">
                                              <Phone size={9} /> {driver.phone}
                                            </span>
                                          )}
                                          {driver.customer && (
                                            <span className="truncate opacity-75">
                                              Acct: {driver.customer.name}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {isSelected && (
                                      <div className="w-5 h-5 rounded-full bg-[var(--brand-lime)] text-black flex items-center justify-center shrink-0">
                                        <Check size={12} strokeWidth={3} />
                                      </div>
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>

                          {/* Footer Info */}
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500 px-1">
                            <span>{billingDrivers.length} active drivers available</span>
                            {editForm.driverId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditForm(prev => ({ ...prev, driverId: '', customerId: '' }));
                                  setIsDriverDropdownOpen(false);
                                }}
                                className="text-red-400 hover:underline"
                              >
                                Clear selection
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-300 block mb-1.5">
                        Linked Customer Billing Account
                      </label>
                      <div className="px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl min-h-[46px] flex items-center justify-between">
                        {editForm.driverId ? (
                          (() => {
                            const drv = billingDrivers.find(d => d._id === editForm.driverId);
                            if (drv?.customer) {
                              return (
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                                    <CheckCircle2 size={16} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-white">{drv.customer.name}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-gray-300">
                                        {drv.customer.customerId}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                      Verified Billing Account
                                    </span>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="text-xs text-amber-400 flex items-center gap-2">
                                <AlertCircle size={14} />
                                <span>No direct customer account linked — will auto-resolve on save</span>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-gray-500 italic">Select a driver on the left</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-xs text-gray-400">
                    This bill will be absorbed as internal workshop expense under <strong className="text-white">Ola Workshop / Internal</strong>.
                  </div>
                )}
              </div>

              {/* Line Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 flex items-center gap-2">
                    <FileText size={15} className="text-[var(--brand-lime)]" /> Bill Items ({editForm.lineItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="px-3 py-1.5 rounded-xl border border-[var(--brand-lime)] text-[var(--brand-lime)] hover:bg-[var(--brand-lime)]/10 text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <div className="border border-[var(--border-main)] rounded-2xl overflow-hidden bg-black/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-gray-400 uppercase font-semibold">
                        <tr>
                          <th className="p-3 w-28">Type</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 w-24 text-center">Qty</th>
                          <th className="p-3 w-32 text-right">Unit Price ($)</th>
                          <th className="p-3 w-32 text-right">Total ($)</th>
                          <th className="p-3 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-main)]">
                        {editForm.lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="p-2.5">
                              <select
                                value={item.type}
                                onChange={(e) => handleLineItemChange(idx, 'type', e.target.value)}
                                className="w-full px-2 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs focus:outline-none"
                              >
                                <option value="PART">PART</option>
                                <option value="LABOUR">LABOUR</option>
                                <option value="MISC">MISC</option>
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.description}
                                placeholder="Item description / part name"
                                onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                                className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs focus:outline-none focus:border-[var(--brand-lime)]"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                                className="w-full px-2 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-center focus:outline-none"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => handleLineItemChange(idx, 'unitPrice', e.target.value)}
                                className="w-full px-3 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-right focus:outline-none"
                              />
                            </td>
                            <td className="p-2.5 text-right font-bold text-white text-sm">
                              ${item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                title="Remove Item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Financial Inputs & Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Inputs: Tax, Discount, Notes */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-300 block mb-1">
                        Tax Rate (%)
                      </label>
                      <select
                        value={editForm.taxRate}
                        onChange={(e) => {
                          const rate = Number(e.target.value);
                          const prof = taxProfiles.find(t => t.rate === rate);
                          setEditForm(prev => ({
                            ...prev,
                            taxRate: rate,
                            taxName: prof?.name || (rate === 7 ? 'ITBMS 7%' : rate === 0 ? 'Exempt' : `Tax ${rate}%`),
                            taxProfileId: prof?._id || ''
                          }));
                        }}
                        className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl text-xs focus:outline-none"
                      >
                        <option value="7">ITBMS 7% (Standard)</option>
                        <option value="0">0% (Tax Exempt)</option>
                        <option value="10">10%</option>
                        <option value="15">15%</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-300 block mb-1">
                        Discount ($)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.discount}
                        onChange={(e) => setEditForm(prev => ({ ...prev, discount: Math.max(0, Number(e.target.value) || 0) }))}
                        className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl text-xs focus:outline-none focus:border-[var(--brand-lime)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1">
                      Notes / Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={editForm.notes}
                      placeholder="Optional notes or invoice terms..."
                      onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-xl text-xs focus:outline-none resize-none"
                    />
                  </div>
                </div>

                {/* Calculation Preview Summary */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2.5 flex flex-col justify-center">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="font-semibold text-white">${editSubtotal.toFixed(2)}</span>
                  </div>
                  {editDiscount > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Discount</span>
                      <span className="font-semibold text-green-400">-${editDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Tax ({editForm.taxRate}%)</span>
                    <span className="font-semibold text-orange-400">+${editTaxAmount.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <div>
                      <span className="text-xs uppercase tracking-wider font-bold text-gray-400 block">Total Amount</span>
                      <span className="text-[10px] text-gray-500">Tax exclusive total</span>
                    </div>
                    <span className="text-2xl font-black text-[var(--brand-lime)]">
                      ${editTotalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-[var(--border-main)] flex gap-3 bg-[var(--bg-input)]">
              <button 
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={isSavingEdit}
                className="flex-1 btn-secondary disabled:opacity-40"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {billToApprove && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-lg p-0 shadow-2xl overflow-hidden border border-white/10 rounded-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-[var(--border-main)] flex items-center justify-between bg-[var(--bg-input)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Confirm Bill Approval</h2>
                  <p className="text-xs text-[var(--text-muted)]">Irreversible action</p>
                </div>
              </div>
              <button 
                onClick={() => !isApproving && setBillToApprove(null)} 
                disabled={isApproving}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-[var(--text-muted)] hover:text-white disabled:opacity-40"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Warning Alert Banner */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-amber-300">Important Notice:</p>
                  <p className="text-amber-200/90 leading-relaxed">
                    Once approved, <strong>no information can be edited</strong>. The bill will be locked, an official workshop invoice will be issued, and accounting ledger entries will be generated permanently.
                  </p>
                </div>
              </div>

              {/* Bill Summary Details */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)]">Bill Number</span>
                  <span className="font-bold text-white font-mono">{billToApprove.billNumber}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)]">Work Order</span>
                  <span className="font-medium text-white">{billToApprove.workOrderId?.workOrderNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--text-muted)]">Billed Party</span>
                  <span className="font-medium text-white text-right">
                    {billToApprove.isDriverBilled 
                      ? (billToApprove.driverId?.personalInfo?.fullName || billToApprove.driverId?.fullName || (typeof billToApprove.driverId === 'string' ? billToApprove.driverId : 'Assigned Driver')) 
                      : 'Ola Workshop'}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Amount</span>
                  <span className="text-lg font-black text-[var(--brand-lime)]">${billToApprove.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 border-t border-[var(--border-main)] flex gap-3 bg-[var(--bg-input)]">
              <button 
                onClick={() => setBillToApprove(null)}
                disabled={isApproving}
                className="flex-1 btn-secondary disabled:opacity-40"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Yes, Approve Bill</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceBills;
