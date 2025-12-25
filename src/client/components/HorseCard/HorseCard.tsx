import type { Horse } from '@shared/types';
import './HorseCard.css';

interface HorseCardProps {
  horse: Horse;
  feedCount: number;
  onClick: () => void;
}

export function HorseCard({ horse, feedCount, onClick }: HorseCardProps) {
  const feedLabel =
    feedCount === 0
      ? 'No feeds assigned'
      : `${feedCount} Feed${feedCount !== 1 ? 's' : ''}`;

  return (
    <div
      class="horse-card"
      data-testid={`horse-card-${horse.id}`}
      onClick={onClick}
    >
      <div class="horse-card-main">
        <div class="horse-card-name" data-testid={`horse-card-name-${horse.id}`}>
          {horse.name}
        </div>
        <div class="horse-card-summary" data-testid={`horse-card-summary-${horse.id}`}>
          <span class="feed-count-pill">{feedLabel}</span>
        </div>
      </div>
      {horse.note && (
        <div class="horse-card-note" data-testid={`horse-card-note-${horse.id}`}>
          <span class="note-icon">i</span>
          <span class="note-text">{horse.note}</span>
        </div>
      )}
      <div class="horse-card-chevron">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}
