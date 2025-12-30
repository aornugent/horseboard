import { createAuthClient } from "better-auth/client";
import { signal } from "@preact/signals";

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
