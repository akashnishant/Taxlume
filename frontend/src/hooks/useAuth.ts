import { useEffect, useState } from "react";
import {
    clearAuthToken,
    getAuthToken,
} from "../services/authStorage";

export type AuthState = {
    isAuthenticated: boolean;
    isLoading: boolean;
};

export function useAuth(): AuthState {
    const [isLoading, setIsLoading] =
        useState(true);

    const token = getAuthToken();

    useEffect(() => {
        setIsLoading(false);
    }, []);

    return {
        isAuthenticated: Boolean(token),
        isLoading,
    };
}

export function logout(): void {
    clearAuthToken();
}