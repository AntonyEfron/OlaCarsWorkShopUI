import api from './api';

export interface InvoicePayment {
    amount: number;
    paidAt: string;
    paymentMethod: string;
    transactionId?: string;
    note?: string;
}

export interface Invoice {
    _id: string;
    invoiceNumber: string;
    invoiceType: 'RENTAL' | 'WORKSHOP';
    driver: any;
    vehicle: any;
    serviceBill?: any;
    weekNumber?: number;
    weekLabel?: string;
    dueDate: string;
    baseAmount: number;
    totalAmountDue: number;
    amountPaid: number;
    balance: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    paidAt?: string;
    payments?: InvoicePayment[];
    createdAt: string;
}

export const getWorkshopInvoices = async (filters: any = {}): Promise<{data: Invoice[], pagination: any}> => {
    const params = new URLSearchParams();
    params.append('invoiceType', 'WORKSHOP');
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.status) params.append('status', filters.status);
    
    const response = await api.get(`/api/invoices?${params.toString()}`);
    return {
        data: response.data.data,
        pagination: response.data.pagination
    };
};
