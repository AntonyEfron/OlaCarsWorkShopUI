import React, { useEffect, useState } from 'react';
import { 
  FileText, Search, Filter, Eye, Clock, AlertCircle, CheckCircle2, 
  Calendar, User, Car, ArrowUpRight, Loader2, X, DollarSign, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWorkshopInvoices, type Invoice } from '../services/invoiceService';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  PARTIAL: 'blue',
  PAID: 'green',
  OVERDUE: 'red',

  
  CANCELLED: 'gray'
};

const WorkshopInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await getWorkshopInvoices();
      setInvoices(response.data);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.driver?.personalInfo?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.vehicle?.legalDocs?.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-brand-lime" />
            Workshop Service Invoices
          </h1>
          <p className="text-sm text-dim">Official driver-billed invoices generated from workshop services</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-main">
          <p className="text-xs font-medium text-dim uppercase tracking-wider">Total Outstanding</p>
          <p className="text-2xl font-bold mt-1">
            ${invoices.reduce((sum, inv) => sum + inv.balance, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-main">
          <p className="text-xs font-medium text-dim uppercase tracking-wider">Pending Invoices</p>
          <p className="text-2xl font-bold mt-1 text-orange-400">
            {invoices.filter(i => i.status === 'PENDING').length}
          </p>
        </div>
        <div className="bg-card p-4 rounded-2xl border border-main">
          <p className="text-xs font-medium text-dim uppercase tracking-wider">Overdue</p>
          <p className="text-2xl font-bold mt-1 text-red-500">
            {invoices.filter(i => i.status === 'OVERDUE').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-2xl border border-main flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={18} />
          <input 
            type="text"
            placeholder="Search by Invoice #, Driver, or Plate..."
            className="w-full pl-10 pr-4 py-2 bg-main border border-main rounded-xl text-sm outline-none focus:border-brand-lime transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-dim" />
          <select 
            className="bg-main border border-main rounded-xl px-4 py-2 text-sm outline-none focus:border-brand-lime cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL">Partial</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-main overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-main/50 text-xs font-bold uppercase tracking-widest text-dim border-b border-main">
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Driver & Vehicle</th>
                <th className="px-6 py-4">Issue Date</th>
                <th className="px-6 py-4">Due Date</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Balance</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-main">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin mx-auto text-brand-lime mb-2" />
                    <span className="text-sm text-dim">Loading invoices...</span>
                  </td>
                </tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-dim text-sm italic">
                    No workshop invoices found.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-main/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{inv.invoiceNumber}</span>
                        {inv.serviceBill?.billNumber && (
                          <span className="text-[10px] font-mono text-dim mt-0.5">Bill: {inv.serviceBill.billNumber}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <User size={14} className="text-dim" />
                          {inv.customer?.name ? (
                            <span className="text-brand-lime">{inv.customer.name} (Customer)</span>
                          ) : (
                            inv.driver?.personalInfo?.fullName || 'N/A'
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-dim uppercase">
                          <Car size={14} />
                          {inv.vehicle?.legalDocs?.registrationNumber || 'N/A'}
                          <span className="opacity-40 mx-1">|</span>
                          <span className="font-mono">{inv.vehicle?.basicDetails?.vin || 'NO VIN'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-dim">
                      {format(new Date(inv.createdAt), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className={inv.status === 'OVERDUE' ? 'text-red-500 font-bold' : 'text-dim'}>
                        {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-sm">
                      ${inv.totalAmountDue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold text-sm ${inv.balance > 0 ? 'text-orange-400' : 'text-brand-lime'}`}>
                        ${inv.balance.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border border-${STATUS_COLORS[inv.status]}-500/20 bg-${STATUS_COLORS[inv.status]}-500/10 text-${STATUS_COLORS[inv.status]}-500`}>
                        {inv.status === 'PAID' && <CheckCircle2 size={10} />}
                        {inv.status === 'PENDING' && <Clock size={10} />}
                        {inv.status === 'OVERDUE' && <AlertCircle size={10} />}
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-2 rounded-lg bg-main hover:bg-brand-lime hover:text-black transition-all"
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-main/30 border-t border-main flex items-center justify-between">
            <p className="text-xs text-dim italic">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-3 py-1 rounded-lg border border-main text-xs disabled:opacity-50 hover:bg-main transition-all"
              >
                Previous
              </button>
              <div className="px-3 py-1 bg-main rounded-lg text-xs font-bold">
                {currentPage} / {totalPages}
              </div>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-3 py-1 rounded-lg border border-main text-xs disabled:opacity-50 hover:bg-main transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-card w-full max-w-2xl rounded-[2.5rem] border border-main shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-8 border-b border-main flex justify-between items-center bg-main/30">
              <div>
                <h2 className="text-2xl font-bold uppercase tracking-tighter">{selectedInvoice.invoiceNumber}</h2>
                <p className="text-xs text-dim uppercase tracking-widest mt-1">
                  Issued: {format(new Date(selectedInvoice.createdAt), 'PPp')}
                </p>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="p-3 rounded-2xl bg-main hover:bg-white/10 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-main border border-main">
                  <p className="text-[10px] font-bold text-dim uppercase tracking-widest">Total Amount</p>
                  <p className="text-xl font-bold mt-1">${selectedInvoice.totalAmountDue.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-2xl bg-brand-lime/5 border border-brand-lime/20">
                  <p className="text-[10px] font-bold text-brand-lime uppercase tracking-widest">Balance Remaining</p>
                  <p className="text-xl font-bold mt-1 text-brand-lime">${selectedInvoice.balance.toLocaleString()}</p>
                </div>
              </div>

              {/* Customer Details */}
              {selectedInvoice.customer && (
                <div className="p-4 rounded-2xl bg-main/50 border border-main space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                    <User size={16} /> Customer Details
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <p className="font-bold">{selectedInvoice.customer.name}</p>
                    {selectedInvoice.customer.email && <p className="text-dim">| {selectedInvoice.customer.email}</p>}
                    {selectedInvoice.customer.phone && <p className="text-dim">| {selectedInvoice.customer.phone}</p>}
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <DollarSign size={16} /> Payment History
                </h3>
                {(() => {
                  const paymentsList = (selectedInvoice as any).payments;
                  return paymentsList && paymentsList.length > 0 ? (
                    <div className="space-y-2">
                      {paymentsList.map((p: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-main/50 rounded-2xl border border-main">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                              <CheckCircle2 size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm">${p.amount.toLocaleString()}</p>
                              <p className="text-[10px] opacity-60">{p.paymentMethod} • {format(new Date(p.paidAt), 'PP')}</p>
                            </div>
                          </div>
                          {p.note && <span className="text-[10px] opacity-40 italic">{p.note}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-main/20 rounded-2xl border border-dashed border-main opacity-40 text-sm italic">
                      No payments recorded yet
                    </div>
                  );
                })()}
              </div>

              {/* Action */}
              <div className="pt-4">
                <button 
                  onClick={() => setSelectedInvoice(null)}
                  className="w-full py-4 rounded-2xl bg-main text-sm font-bold hover:bg-white/10 transition-all"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkshopInvoices;
