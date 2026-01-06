import { useState, useEffect } from 'preact/hooks';

export function useThemeTransition() {
    const [enableTransition, setEnableTransition] = useState(false);

    useEffect(() => {
        // Enable transition in next frame/tick to allow initial render without transition
        const timer = requestAnimationFrame(() => {
            setEnableTransition(true);
        });
        return () => cancelAnimationFrame(timer);
    }, []);

    return enableTransition ? 'theme-transition' : '';
}
