import type { Feed } from '@shared/types';
import './FeedCard.css';

interface FeedCardProps {
  feed: Feed;
  horseCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FeedCard({ feed, horseCount, onEdit, onDelete }: FeedCardProps) {
  return (
    <div
      class={`feed-card ${!onEdit ? 'readonly' : ''}`}
      data-testid={`feed-card-${feed.id}`}
    >
      <div class="feed-card-content" onClick={onEdit}>
        <div class="feed-card-name" data-testid={`feed-card-name-${feed.id}`}>
          {feed.name}
        </div>
        <div class="feed-card-meta" data-testid={`feed-card-meta-${feed.id}`}>
          <span class="feed-card-unit">{feed.unit}</span>
          <span class="feed-card-usage">
            {horseCount === 0 ? 'Not in use' : `${horseCount} horse${horseCount !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
      {onDelete && (
        <button
          class="feed-card-delete"
          data-testid={`feed-card-delete-${feed.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${feed.name}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
          </svg>
        </button>
      )}
    </div>
  );
}
