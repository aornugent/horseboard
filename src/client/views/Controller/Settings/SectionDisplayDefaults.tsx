import {
    orientation,
    zoom_level,
    board,
    setOrientation,
    setZoomLevel
} from '../../../stores';
import { updateBoard as apiUpdateBoard, updateOrientation as apiUpdateOrientation } from '../../../services';

async function changeOrientation(orientation: 'horse-major' | 'feed-major') {
    if (!board.value) return;
    try {
        await apiUpdateOrientation(board.value.id, orientation);
        setOrientation(orientation);
    } catch (err) {
        console.error('Failed to update orientation:', err);
    }
}

async function changeZoom(level: 1 | 2 | 3) {
    if (!board.value) return;
    try {
        await apiUpdateBoard(board.value.id, { zoom_level: level });
        setZoomLevel(level);
    } catch (err) {
        console.error('Failed to update zoom:', err);
    }
}

export function SectionDisplayDefaults() {
    return (
        <section class="section" data-testid="display-defaults-section">
            <h3 class="section-title">Display Defaults</h3>
            <p class="section-description">
                Configure default orientation and zoom for TV displays
            </p>

            <div class="settings-control-group">
                <label class="settings-subsection-title">Default Orientation</label>
                <div class="settings-segmented" data-testid="default-orientation-selector">
                    <button
                        class={orientation.value === 'horse-major' ? 'active' : ''}
                        onClick={() => changeOrientation('horse-major')}
                    >
                        Horses
                    </button>
                    <button
                        class={orientation.value === 'feed-major' ? 'active' : ''}
                        onClick={() => changeOrientation('feed-major')}
                    >
                        Feeds
                    </button>
                </div>
            </div>

            <div class="settings-control-group">
                <label class="settings-subsection-title">Default Zoom</label>
                <div class="settings-segmented" data-testid="default-zoom-selector">
                    <button class={zoom_level.value === 1 ? 'active' : ''} onClick={() => changeZoom(1)}>S</button>
                    <button class={zoom_level.value === 2 ? 'active' : ''} onClick={() => changeZoom(2)}>M</button>
                    <button class={zoom_level.value === 3 ? 'active' : ''} onClick={() => changeZoom(3)}>L</button>
                </div>
            </div>
        </section>
    );
}
