import api from './api';

export type BillStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID' | 'VOID';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Insurance' | 'Internal';

export interface BillLineItem {
  _id?: string;
  type: 'LABOUR' | 'PART' | 'MISC';
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BillPayment {
  _id?: string;
  amount: number;
  paidAt: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
}

export interface ServiceBill {
  _id: string;
  billNumber: string;
  workOrderId: string | any;
  vehicleId: string | any;
  branchId: string | { _id: string; name: string };
  isDriverBilled: boolean;
  status: BillStatus;
  lineItems: BillLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  paymentStatus: PaymentStatus;
  payments: BillPayment[];
  invoiceNumber?: string;
  createdAt: string;
}

export const getBills = async (filters: any = {}) => {
  const response = await api.get(`/api/service-bills`, {
    params: filters
  });
  return response.data.data;
};

export const getBillById = async (id: string) => {
  const response = await api.get(`/api/service-bills/${id}`);
  return response.data.data;
};

export const generateBill = async (data: {
  workOrderId: string;
  taxRate?: number;
  hourlyRate?: number;
  discount?: number;
  notes?: string;
  additionalCharges?: { description: string, amount: number }[];
}) => {
  const response = await api.post(`/api/service-bills`, data);
  return response.data.data;
};

export const approveBill = async (id: string) => {
  const response = await api.put(`/api/service-bills/${id}/approve`);
  return response.data.data;
};

export const recordPayment = async (id: string, paymentData: {
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  paidAt?: string;
  accountingCode?: string;
}) => {
  const response = await api.post(`/api/service-bills/${id}/payments`, paymentData);
  return response.data.data;
};

export const voidBill = async (id: string, reason: string) => {
  const response = await api.put(`/api/service-bills/${id}/void`, { reason });
  return response.data.data;
};

export const getAccountingCodes = async (filters: any = {}) => {
  const response = await api.get(`/api/accounting-code`, { params: filters });
  return response.data.data;
};
