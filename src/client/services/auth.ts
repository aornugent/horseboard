import { createAuthClient } from "better-auth/client";
import { signal, effect } from "@preact/signals";
import { onAuthError, setControllerToken } from "./api";

export const authClient = createAuthClient({
    baseURL: window.location.origin,
});

export const authState = signal<{
    user: typeof authClient.$Infer.Session.user | null;
    session: typeof authClient.$Infer.Session.session | null;
    isLoading: boolean;
}>({
    user: null,
    session: null,
    isLoading: true,
});

export async function initAuth() {
    authState.value = { ...authState.value, isLoading: true };
    try {
        const { data } = await authClient.getSession();
        if (data) {
            authState.value = {
                user: data.user,
                session: data.session,
                isLoading: false,
            };
        } else {
            authState.value = {
                user: null,
                session: null,
                isLoading: false,
            };
        }
    } catch (error) {
        console.error("Failed to init auth", error);
        authState.value = { ...authState.value, isLoading: false };
    }
}

// Global auth error handler
effect(() => {
    const error = onAuthError.value;
    if (error) {
        console.log('Auth error detected, clearing session:', error.message);

        // Clear controller token
        setControllerToken(null);

        // Clear auth state
        authState.value = {
            user: null,
            session: null,
            isLoading: false,
        };

        // Redirect to login if needed
        // We avoid redirecting if on public pages, but for now we enforce login for app
        // If we are in controller, go to login.
        if (window.location.pathname.startsWith('/controller')) {
            window.location.href = '/login';
        }

        // Reset the signal so we don't loop or re-trigger immediately
        onAuthError.value = null;
    }
});
