import api from "./api";

export type VendorAddress = {
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

export type Vendor = {
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
    addresses: VendorAddress[];
};

export type CreateVendorRequest = {
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

export async function getVendors(): Promise<Vendor[]> {
    const response = await api.get<{
        success: boolean;
        vendors: Vendor[];
    }>("/api/vendors");

    return response.data.vendors;
}

export async function getVendor(
    id: string,
): Promise<Vendor> {
    const response = await api.get<{
        success: boolean;
        vendor: Vendor;
    }>(`/api/vendors/${id}`);

    return response.data.vendor;
}

export async function createVendor(
    data: CreateVendorRequest,
): Promise<{
    id: string;
    display_name: string;
}> {
    const response = await api.post<{
        success: boolean;
        vendor: {
            id: string;
            display_name: string;
        };
    }>("/api/vendors", data);

    return response.data.vendor;
}

export async function updateVendor(
    id: string,
    data: CreateVendorRequest,
): Promise<void> {
    await api.put<{
        success: boolean;
        message: string;
    }>(`/api/vendors/${id}`, data);
}

export async function updateVendorStatus(
    id: string,
    isActive: boolean,
): Promise<void> {
    await api.patch<{
        success: boolean;
        message: string;
    }>(`/api/vendors/${id}/status`, {
        is_active: isActive,
    });
}