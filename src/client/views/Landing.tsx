import { navigate } from '../router';

export function Landing() {
    return (
        <div class="landing-view" data-testid="landing-view">
            <div class="landing-content">
                <h1 class="landing-title">HorseBoard</h1>
                <p class="landing-subtitle">Barn Feed Management System</p>

                <div class="landing-links">
                    <a
                        href="/controller"
                        class="landing-link landing-link-primary"
                        data-testid="landing-controller-link"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/controller');
                        }}
                    >
                        <span class="landing-link-icon">📱</span>
                        <span class="landing-link-text">Controller</span>
                        <span class="landing-link-description">Manage feeds from your phone</span>
                    </a>

                    <a
                        href="/board"
                        class="landing-link"
                        data-testid="landing-board-link"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate('/board');
                        }}
                    >
                        <span class="landing-link-icon">📺</span>
                        <span class="landing-link-text">Board</span>
                        <span class="landing-link-description">Show feed board on TV</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
