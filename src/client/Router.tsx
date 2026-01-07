

import { appMode } from './hooks/useAppMode';
import { pathname, navigate } from './router';
import { isTokenInvalid, initializeApp } from './services/lifecycle';
import { STORAGE_KEY } from './constants';
import { boardId } from './stores/token';

import { Landing } from './views/Landing';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';
import { ControllerView } from './views/ControllerView';
import { Board } from './views/Board';
import { ProvisioningView } from './views/ProvisioningView';

export function Router() {
    const mode = appMode.value;
    const path = pathname.value;

    // Loading state
    if (mode === 'loading') {
        return <div class="loading-spinner">Loading...</div>;
    }

    // Route matching
    if (path === '/login') return <LoginView />;
    if (path === '/signup') return <SignupView />;

    if (path === '/board') {
        // Display or provisioning
        // If unauthenticated or token invalid, show provisioning
        if (mode === 'unauthenticated' || isTokenInvalid.value) {
            return <ProvisioningView onProvisioned={(id) => {
                isTokenInvalid.value = false;
                localStorage.setItem(STORAGE_KEY, id);
                boardId.value = id;
                initializeApp(id);
            }} />;
        }
        return <Board />;
    }

    if (path === '/controller') {
        if (mode === 'unauthenticated') {
            navigate('/');
            return null;
        }
        return <ControllerView />;
    }

    // Landing page - redirect if authenticated
    if (mode !== 'unauthenticated') {
        navigate('/controller');
        return null;
    }
    return <Landing />;
}
