import React, { useEffect, useState } from 'react';
import { 
  Receipt, Search, Filter, Eye, DollarSign, X, CheckCircle2, 
  Clock, AlertCircle, ArrowUpRight, MoreHorizontal, ChevronDown,
  CreditCard, Banknote, Landmark, FileText, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  getBills, getBillById, approveBill, recordPayment, voidBill,
  type ServiceBill, type BillStatus, type PaymentStatus, type PaymentMethod 
} from '../services/serviceBillService';
import { format } from 'date-fns';

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const selectedAccountCode = '4010';

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

  const handleApprove = async (id: string) => {
    try {
      const updated = await approveBill(id);
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
      if (selectedBill?._id === id) {
        setSelectedBill(updated);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve bill');
    }
  };

  const handleOpenPayment = (bill: ServiceBill) => {
    setSelectedBill(bill);
    setPaymentAmount(bill.totalAmount - (bill.amountPaid || 0));
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!selectedBill) return;
    try {
      setSubmittingPayment(true);
      await recordPayment(selectedBill._id, {
        amount: paymentAmount,
        paymentMethod,
        paymentReference: paymentRef,
        notes: paymentNotes,
        accountingCode: selectedAccountCode
      });
      toast.success('Payment recorded and synced to Ledger');
      setShowPaymentModal(false);
      setPaymentRef('');
      setPaymentNotes('');
      loadBills();
      
      // Refresh detail modal if open
      const updated = await getBillById(selectedBill._id);
      setSelectedBill(updated);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
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
                        Driver Billed
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
                          onClick={() => handleApprove(bill._id)}
                          className="p-2 hover:bg-[var(--bg-input)] rounded-lg transition-colors text-blue-500"
                          title="Approve Bill"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                      )}
                      {(bill.status === 'APPROVED' || (bill.status === 'PAID' && bill.paymentStatus === 'PARTIAL')) && (
                        <button 
                          onClick={() => handleOpenPayment(bill)}
                          className="p-2 hover:bg-[var(--bg-input)] rounded-lg transition-colors text-green-500"
                          title="Record Payment"
                        >
                          <DollarSign size={18} />
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
                <button 
                  onClick={() => handleApprove(selectedBill._id)}
                  className="flex-1 btn-primary"
                >
                  Approve Bill
                </button>
              )}
              {(selectedBill.status === 'APPROVED' || (selectedBill.status === 'PAID' && selectedBill.paymentStatus === 'PARTIAL')) && (
                <button 
                  onClick={() => handleOpenPayment(selectedBill)}
                  className="flex-1 btn-primary"
                >
                  Record Payment
                </button>
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

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="glass-card w-full max-w-md p-6 space-y-6 shadow-2xl relative">
            <button onClick={() => setShowPaymentModal(false)} className="absolute right-4 top-4 p-2 opacity-40 hover:opacity-100 transition-opacity">
              <X size={20} />
            </button>
            
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-[var(--brand-lime-alpha)] flex items-center justify-center mx-auto text-[var(--brand-lime)]">
                <DollarSign size={32} />
              </div>
              <h2 className="text-xl font-bold">Record Payment</h2>
              <p className="text-xs opacity-60">Record manual payment for {selectedBill.billNumber}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 block mb-2">Amount to Pay</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold opacity-40">$</span>
                  <input
                    type="number"
                    className="w-full pl-8 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl focus:outline-none focus:border-[var(--brand-lime)] font-bold text-lg"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    max={selectedBill.totalAmount - selectedBill.amountPaid}
                  />
                  <button 
                    onClick={() => setPaymentAmount(selectedBill.totalAmount - selectedBill.amountPaid)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-[var(--brand-lime)] hover:underline"
                  >
                    Full Balance
                  </button>
                </div>
                <p className="text-[10px] mt-2 opacity-40 text-center">Remaining Balance: ${(selectedBill.totalAmount - selectedBill.amountPaid).toLocaleString()}</p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Cash', icon: Banknote },
                    { id: 'Bank Transfer', icon: Landmark },
                    { id: 'Credit Card', icon: CreditCard }
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                        paymentMethod === method.id 
                          ? 'bg-[var(--brand-lime)] border-[var(--brand-lime)] text-black' 
                          : 'bg-[var(--bg-input)] border-[var(--border-main)] opacity-60'
                      }`}
                    >
                      <method.icon size={20} className="mb-1" />
                      <span className="text-[10px] font-bold">{method.id}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 block mb-2">Reference / Transaction ID</label>
                <input
                  type="text"
                  placeholder="e.g. TRX-9928..."
                  className="w-full px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl focus:outline-none focus:border-[var(--brand-lime)] text-sm"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest opacity-60 block mb-2">Accounting Code</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl opacity-60">
                  <Landmark size={18} className="text-[var(--brand-lime)]" />
                  <span className="text-sm font-bold">4010 - Workshop Service Income</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRecordPayment}
                  disabled={submittingPayment || paymentAmount <= 0}
                  className="flex-1 btn-primary"
                >
                  {submittingPayment ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceBills;
