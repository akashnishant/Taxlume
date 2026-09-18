import api from "./api";

export type Product = {
    id: string;
    item_type: "PRODUCT" | "SERVICE";
    name: string;
    description: string | null;
    sku: string | null;
    hsn_sac: string | null;
    unit: string;
    selling_price_paise: number;
    purchase_price_paise: number;
    gst_rate_bps: number;
    cess_rate_bps: number;
    opening_stock_milli: number;
    track_inventory: number;
    is_active: number;
    created_at: string;
    updated_at: string;
};

export type CreateProductRequest = {
    item_type?: "PRODUCT" | "SERVICE";
    name: string;
    description?: string;
    sku?: string;
    hsn_sac?: string;
    unit?: string;
    selling_price_paise?: number;
    purchase_price_paise?: number;
    gst_rate_bps?: number;
    cess_rate_bps?: number;
    opening_stock_milli?: number;
    track_inventory?: boolean;
};

export async function getProducts(): Promise<Product[]> {
    const response = await api.get<{
        success: boolean;
        products: Product[];
    }>("/api/products");

    return response.data.products;
}

export async function getProduct(
    id: string,
): Promise<Product> {
    const response = await api.get<{
        success: boolean;
        product: Product;
    }>(`/api/products/${id}`);

    return response.data.product;
}

export async function createProduct(
    data: CreateProductRequest,
): Promise<{
    id: string;
    name: string;
    item_type: string;
}> {
    const response = await api.post<{
        success: boolean;
        product: {
            id: string;
            name: string;
            item_type: string;
        };
    }>("/api/products", data);

    return response.data.product;
}

export async function updateProduct(
    id: string,
    data: CreateProductRequest,
): Promise<void> {
    await api.put<{
        success: boolean;
        message: string;
    }>(`/api/products/${id}`, data);
}

export async function updateProductStatus(
    id: string,
    isActive: boolean,
): Promise<void> {
    await api.patch<{
        success: boolean;
        message: string;
    }>(`/api/products/${id}/status`, {
        is_active: isActive,
    });
}