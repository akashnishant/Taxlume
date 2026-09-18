import api from "./api";

export type Company = {
    id: string;
    legal_name: string;
    trade_name: string | null;
    gstin: string | null;
    pan: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    state_code: string | null;
    pincode: string | null;
    country: string | null;
    logo_key: string | null;
    signature_key: string | null;
    currency_code: string;
    financial_year_start_month: number;
};

export type UpdateCompanyRequest = {
    legal_name: string;
    trade_name?: string;
    gstin?: string;
    pan?: string;
    email?: string;
    phone?: string;
    website?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    state_code?: string;
    pincode?: string;
    country: string;
    currency_code: string;
    financial_year_start_month: number;
};

export async function getCompany(): Promise<Company> {
    const response = await api.get<{
        success: boolean;
        company: Company;
    }>("/api/company");

    return response.data.company;
}

export async function updateCompany(
    data: UpdateCompanyRequest,
): Promise<Company> {
    const response = await api.put<{
        success: boolean;
        company: Company;
    }>("/api/company", data);

    return response.data.company;
}

export type UploadCompanySignatureResponse = {
    signature_key: string;
};

export async function uploadCompanySignature(
    file: File,
): Promise<UploadCompanySignatureResponse> {
    const formData = new FormData();

    formData.append("signature", file);

    const response = await api.post<{
        success: boolean;
        message: string;
        signature_key: string;
    }>(
        "/api/company/signature",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        },
    );

    return {
        signature_key: response.data.signature_key,
    };
}

export async function getCompanySignatureDataUrl(): Promise<string | null> {
    try {
        const response = await api.get<Blob>(
            "/api/company/signature",
            {
                responseType: "blob",
            },
        );

        const blob = response.data;

        return await new Promise<string>(
            (resolve, reject) => {
                const reader = new FileReader();

                reader.onloadend = () => {
                    if (
                        typeof reader.result === "string"
                    ) {
                        resolve(reader.result);
                        return;
                    }

                    reject(
                        new Error(
                            "Unable to read signature image.",
                        ),
                    );
                };

                reader.onerror = () => {
                    reject(
                        new Error(
                            "Unable to read signature image.",
                        ),
                    );
                };

                reader.readAsDataURL(blob);
            },
        );
    } catch {
        return null;
    }
}

export async function deleteCompanySignature(): Promise<void> {
    await api.delete(
        "/api/company/signature",
    );
}