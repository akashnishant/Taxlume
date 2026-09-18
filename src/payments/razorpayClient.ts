const RAZORPAY_API_BASE_URL =
    "https://api.razorpay.com/v1";

export type RazorpayApiError = {
    error?: {
        code?: string;
        description?: string;
        field?: string;
        source?: string;
        step?: string;
        reason?: string;
    };
};

export class RazorpayRequestError extends Error {
    readonly status: number;
    readonly response: RazorpayApiError | null;

    constructor(
        message: string,
        status: number,
        response: RazorpayApiError | null,
    ) {
        super(message);

        this.name = "RazorpayRequestError";
        this.status = status;
        this.response = response;
    }
}

function getAuthorizationHeader(env: Env): string {
    const credentials =
        `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`;

    return `Basic ${btoa(credentials)}`;
}

export async function razorpayRequest<T>(
    env: Env,
    path: string,
    init: RequestInit = {},
): Promise<T> {
    const response = await fetch(
        `${RAZORPAY_API_BASE_URL}${path}`,
        {
            ...init,

            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization:
                    getAuthorizationHeader(env),
                ...init.headers,
            },
        },
    );

    if (!response.ok) {
        let errorResponse:
            | RazorpayApiError
            | null = null;

        try {
            errorResponse =
                await response.json<RazorpayApiError>();
        } catch {
            errorResponse = null;
        }

        const message =
            errorResponse?.error?.description ??
            `Razorpay request failed with HTTP ${response.status}.`;

        throw new RazorpayRequestError(
            message,
            response.status,
            errorResponse,
        );
    }

    return response.json<T>();
}