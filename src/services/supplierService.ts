import api from './api';

export interface Supplier {
    _id: string;
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    category: string[];
}

export const getSuppliers = async (params: any = {}): Promise<Supplier[]> => {
    const response = await api.get('/api/supplier', { params });
    return response.data.data || response.data;
};
