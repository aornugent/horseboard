import type { Feed } from '@shared/types';


interface FeedCardProps {
  feed: Feed;
  horseCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function FeedCard({ feed, horseCount, onEdit, onDelete }: FeedCardProps) {
  return (
    <div
      class={`list-card ${!onEdit ? 'readonly' : ''}`}
      data-testid={`feed-card-${feed.id}`}
    >
      <div class="list-card-content" onClick={onEdit}>
        <div class="list-card-name" data-testid={`feed-card-name-${feed.id}`}>
          {feed.name}
        </div>
        <div class="list-card-meta" data-testid={`feed-card-meta-${feed.id}`}>
          <span class="list-card-badge">{feed.unit_label}</span>
          <span class="list-card-usage">
            {horseCount === 0 ? 'Not in use' : `${horseCount} horse${horseCount !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>
      {onDelete && (
        <button
          class="icon-btn icon-btn--ghost icon-btn--danger"
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
