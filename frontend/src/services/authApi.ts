import api from "./api";

export type LoginRequest = {
    email: string;
    password: string;
};

export type LoginResponse = {
    success: boolean;
    token: string;
    user: {
        id: string;
        email: string;
        full_name: string;
    };
    company: {
        id: string;
        legal_name: string;
        trade_name: string | null;
        role: string;
    };
};

export type RegisterRequest = {
    email: string;
    password: string;
    full_name: string;

    company: {
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
        country?: string;
        currency_code?: string;
    };
};

export type RegisterResponse = {
    success: boolean;
    user_id: string;
    company_id: string;
    message: string;
};

export async function login(
    data: LoginRequest,
): Promise<LoginResponse> {
    const response =
        await api.post<LoginResponse>(
            "/api/auth/login",
            data,
        );

    return response.data;
}

export async function register(
    data: RegisterRequest,
): Promise<RegisterResponse> {
    const response =
        await api.post<RegisterResponse>(
            "/api/auth/register",
            data,
        );

    return response.data;
}