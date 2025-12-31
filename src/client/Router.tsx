import { pathname } from './router';
import { board } from './stores';
import { isInitialized, initializeApp, STORAGE_KEY } from './services/lifecycle';
import { Landing } from './views/Landing';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';
import { ControllerView } from './views/ControllerView';
import { Board } from './views/Board';
import { PairingView } from './views/PairingView';
import { ProvisioningView } from './views/ProvisioningView';

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

    if (needsPairing && !storedBoardId) {
        return (
            <ProvisioningView
                onProvisioned={(id: string) => {
                    localStorage.setItem(STORAGE_KEY, id);
                    initializeApp(id);
                }}
            />
        );
    }
    return <Board />;
}

const routes: Record<string, () => import('preact').JSX.Element> = {
    '/': Landing,
    '/login': LoginView,
    '/signup': SignupView,
    '/controller': GuardedController,
    '/board': GuardedBoard,
};

export function Router() {
    const Component = routes[pathname.value] || Landing;
    return <Component />;
}
