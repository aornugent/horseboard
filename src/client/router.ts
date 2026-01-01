import { signal } from '@preact/signals';

export const pathname = signal(window.location.pathname);

window.addEventListener('popstate', () => {
    pathname.value = window.location.pathname;
});

export function navigate(path: string) {
    if (pathname.value !== path) {
        window.history.pushState({}, '', path);
        pathname.value = path;
    }
}
