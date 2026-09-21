import axios from "axios";
import { getAuthToken } from "./authStorage";
import { endSession } from "./endSession";

type ApiErrorResponse = {
    success?: boolean;
    code?: string;
    message?: string;
};

const api = axios.create({
    baseURL:
        import.meta.env.VITE_API_BASE_URL,

    headers: {
        "Content-Type":
            "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        const token =
            getAuthToken();

        if (token) {
            config.headers.Authorization =
                `Bearer ${token}`;
        }

        return config;
    },
);

api.interceptors.response.use(
    (response) => response,

    (error) => {
        const status =
            error.response?.status;

        const data =
            error.response
                ?.data as
                | ApiErrorResponse
                | undefined;

        const requestUrl = error.config?.url ?? "";
        const isGuestRequest =
            /\/api\/auth\/(login|register)(?:\?|$)/.test(requestUrl);

        const requestAuthorization =
        error.config?.headers?.Authorization;

        const currentToken = getAuthToken();

        if (
        status === 401 &&
        !isGuestRequest &&
        currentToken &&
        requestAuthorization === `Bearer ${currentToken}`
        ) {
            endSession("reauth");
        }

        if (
            status === 402 &&
            data?.code ===
                "SUBSCRIPTION_REQUIRED"
        ) {
            if (
                window.location.pathname !==
                "/subscribe"
            ) {
                window.location.replace(
                    "/subscribe",
                );
            }
        }

        return Promise.reject(error);
    },
);

export default api;