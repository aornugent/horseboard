
import { signal } from "@preact/signals";
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_API_URL // defaults to same-origin
});

export const user = signal<typeof authClient.$Infer.Session.user | null>(null);
export const session = signal<typeof authClient.$Infer.Session.session | null>(null);

export const authState = {
    user,
    session,
    checkSession: async () => {
        const { data } = await authClient.getSession();
        if (data) {
            user.value = data.user;
            session.value = data.session;
        } else {
            user.value = null;
            session.value = null;
        }
    }
};
