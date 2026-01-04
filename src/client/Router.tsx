import { pathname, navigate } from './router';
import { board } from './stores';
import { isInitialized, initializeApp, STORAGE_KEY, isTokenInvalid } from './services/lifecycle';
import { Landing } from './views/Landing';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';
import { ControllerView } from './views/ControllerView';
import { Board } from './views/Board';
import { PairingView } from './views/PairingView';
import { ProvisioningView } from './views/ProvisioningView';

function GuardedLanding() {
    const storedBoardId = localStorage.getItem(STORAGE_KEY);

    // If user has sticky access, auto-redirect to controller
    if (storedBoardId && board.value) {
        navigate('/controller');
        return null;
    }

    return <Landing />;
}

function GuardedController() {
    const needsPairing = !board.value && !isInitialized.value;
    const storedBoardId = localStorage.getItem(STORAGE_KEY);

    if (needsPairing && !storedBoardId) {
        return <PairingView />;
    }
    return <ControllerView />;
}

function GuardedBoard() {
    const needsPairing = !board.value && !isInitialized.value;
    const storedBoardId = localStorage.getItem(STORAGE_KEY);

    // Show provisioning if: no board cached, OR token was invalidated (revoked)
    if ((needsPairing && !storedBoardId) || isTokenInvalid.value) {
        return (
            <ProvisioningView
                onProvisioned={(id: string) => {
                    isTokenInvalid.value = false;
                    localStorage.setItem(STORAGE_KEY, id);
                    initializeApp(id);
                }}
            />
        );
    }
    return <Board />;
}

const routes: Record<string, () => import('preact').JSX.Element | null> = {
    '/': GuardedLanding,
    '/login': LoginView,
    '/signup': SignupView,
    '/controller': GuardedController,
    '/board': GuardedBoard,
};

export function Router() {
    const Component = routes[pathname.value] || GuardedLanding;
    return <Component />;
}
