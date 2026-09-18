import api from "./api";

export type CustomerAddress = {
    id: string;
    address_type: string;
    label: string | null;
    address_line1: string;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
    pincode: string | null;
    country: string;
    is_default: number;
};

export type Customer = {
    id: string;
    display_name: string;
    legal_name: string | null;
    gstin: string | null;
    pan: string | null;
    email: string | null;
    phone: string | null;
    alternate_phone: string | null;
    contact_person: string | null;
    opening_balance_paise: number;
    credit_limit_paise: number;
    payment_terms_days: number;
    notes: string | null;
    is_active: number;
    created_at: string;
    updated_at: string;
    addresses: CustomerAddress[];
};

export type CreateCustomerRequest = {
    display_name: string;
    legal_name?: string;
    gstin?: string;
    pan?: string;
    email?: string;
    phone?: string;
    alternate_phone?: string;
    contact_person?: string;
    address?: {
        address_line1: string;
        address_line2?: string;
        city?: string;
        state?: string;
        state_code?: string;
        pincode?: string;
        country?: string;
    };
    opening_balance_paise?: number;
    credit_limit_paise?: number;
    payment_terms_days?: number;
    notes?: string;
};

export async function getCustomers(): Promise<Customer[]> {
    const response = await api.get<{
        success: boolean;
        customers: Customer[];
    }>("/api/customers");

    return response.data.customers;
}

export async function getCustomer(
    id: string,
): Promise<Customer> {
    const response = await api.get<{
        success: boolean;
        customer: Customer;
    }>(`/api/customers/${id}`);

    return response.data.customer;
}

export async function createCustomer(
    data: CreateCustomerRequest,
): Promise<{
    id: string;
    display_name: string;
    role: string;
}> {
    const response = await api.post<{
        success: boolean;
        customer: {
            id: string;
            display_name: string;
            role: string;
        };
    }>("/api/customers", data);

    return response.data.customer;
}

export async function updateCustomer(
    id: string,
    data: CreateCustomerRequest,
): Promise<void> {
    await api.put<{
        success: boolean;
        message: string;
    }>(`/api/customers/${id}`, data);
}

export async function updateCustomerStatus(
    id: string,
    isActive: boolean,
): Promise<void> {
    await api.patch<{
        success: boolean;
        message: string;
    }>(`/api/customers/${id}/status`, {
        is_active: isActive,
    });
}