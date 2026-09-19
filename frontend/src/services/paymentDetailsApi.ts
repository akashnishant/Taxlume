import api from "./api";

export type PaymentDetails = {
    id: string | null;
    company_id: string;
    bank_name: string | null;
    account_holder_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    branch_name: string | null;
    upi_id: string | null;
    qr_code_key: string | null;
    show_qr_on_invoice: boolean;
};

export type UpdatePaymentDetailsRequest = {
    bank_name?: string | null;
    account_holder_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
    branch_name?: string | null;
    upi_id?: string | null;
    show_qr_on_invoice?: boolean;
};

export type UploadPaymentQrResponse = {
    qr_code_key: string;
};

export async function getPaymentDetails(): Promise<PaymentDetails> {
    const response = await api.get<{
        success: boolean;
        payment_details: PaymentDetails;
    }>("/api/company/payment-details");

    return response.data.payment_details;
}

export async function updatePaymentDetails(
    data: UpdatePaymentDetailsRequest,
): Promise<PaymentDetails> {
    const response = await api.put<{
        success: boolean;
        message: string;
        payment_details: PaymentDetails;
    }>(
        "/api/company/payment-details",
        data,
    );

    return response.data.payment_details;
}

export async function uploadPaymentQr(
    file: File,
): Promise<UploadPaymentQrResponse> {
    const formData = new FormData();

    formData.append("qr_code", file);

    const response = await api.post<{
        success: boolean;
        message: string;
        qr_code_key: string;
    }>(
        "/api/company/payment-details/qr",
        formData,
        {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        },
    );

    return {
        qr_code_key: response.data.qr_code_key,
    };
}

export async function deletePaymentQr(): Promise<void> {
  await api.delete("/api/company/payment-details/qr");
}

export async function getPaymentQrDataUrl(): Promise<string | null> {
    try {
        const response = await api.get<Blob>(
            "/api/company/payment-details/qr",
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
                            "Unable to read QR code image.",
                        ),
                    );
                };

                reader.onerror = () => {
                    reject(
                        new Error(
                            "Unable to read QR code image.",
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