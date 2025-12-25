import { useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { FeedPad } from '../../components/FeedPad';
import { formatQuantity } from '@shared/fractions';
import { getHorse } from '../../stores/horses';
import { feeds, getFeed } from '../../stores/feeds';
import { dietByHorse, updateDietAmount, getDietEntry } from '../../stores/diet';
import './HorseDetail.css';

interface HorseDetailProps {
  horseId: string;
  onBack: () => void;
}

interface SelectedFeed {
  feedId: string;
  field: 'amAmount' | 'pmAmount';
}

export function HorseDetail({ horseId, onBack }: HorseDetailProps) {
  const [selectedFeed, setSelectedFeed] = useState<SelectedFeed | null>(null);

  const horse = getHorse(horseId);

  // Get feeds that have diet entries for this horse
  const activeFeeds = computed(() => {
    const entries = dietByHorse.value.get(horseId) ?? [];
    const activeFeedIds = new Set(
      entries
        .filter((e) => e.amAmount !== null || e.pmAmount !== null)
        .map((e) => e.feedId)
    );

    // Return all feeds, with active ones first
    return feeds.value.sort((a, b) => {
      const aActive = activeFeedIds.has(a.id);
      const bActive = activeFeedIds.has(b.id);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return b.rank - a.rank;
    });
  });

  if (!horse) {
    return (
      <div class="horse-detail" data-testid="horse-detail">
        <div class="horse-detail-error">Horse not found</div>
      </div>
    );
  }

  const getCurrentValue = (): number | null => {
    if (!selectedFeed) return null;
    const entry = getDietEntry(horseId, selectedFeed.feedId);
    return entry?.[selectedFeed.field] ?? null;
  };

  const handleValueChange = (value: number | null) => {
    if (!selectedFeed) return;
    updateDietAmount(horseId, selectedFeed.feedId, selectedFeed.field, value);
  };

  const getSelectedFeedInfo = () => {
    if (!selectedFeed) return { name: '', unit: '' };
    const feed = getFeed(selectedFeed.feedId);
    return {
      name: feed?.name ?? '',
      unit: feed?.unit ?? '',
    };
  };

  const feedInfo = getSelectedFeedInfo();

  return (
    <div class="horse-detail" data-testid="horse-detail">
      <header class="horse-detail-header">
        <button
          class="horse-detail-back"
          data-testid="horse-detail-back"
          onClick={onBack}
          aria-label="Go back"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 class="horse-detail-name" data-testid="horse-detail-name">
          {horse.name}
        </h2>
      </header>

      {horse.note && (
        <div class="horse-detail-note" data-testid="horse-detail-note">
          <span class="note-label">Note:</span> {horse.note}
        </div>
      )}

      {/* Active feeds as large tappable tiles */}
      <div class="feed-tiles" data-testid="feed-tiles">
        {activeFeeds.value.map((feed) => {
          const entry = getDietEntry(horseId, feed.id);
          const amValue = entry?.amAmount;
          const pmValue = entry?.pmAmount;

          return (
            <div
              key={feed.id}
              class="feed-tile"
              data-testid={`feed-tile-${feed.id}`}
            >
              <div class="feed-tile-header">
                <span class="feed-tile-name">{feed.name}</span>
                <span class="feed-tile-unit">{feed.unit}</span>
              </div>
              <div class="feed-tile-values">
                {/* AM value */}
                <button
                  class="value-button"
                  data-testid={`feed-tile-am-${feed.id}`}
                  onClick={() => setSelectedFeed({ feedId: feed.id, field: 'amAmount' })}
                >
                  <span class="value-label">AM</span>
                  <span class="value-amount">
                    {formatQuantity(amValue, feed.unit) || '—'}
                  </span>
                </button>

                {/* PM value */}
                <button
                  class="value-button"
                  data-testid={`feed-tile-pm-${feed.id}`}
                  onClick={() => setSelectedFeed({ feedId: feed.id, field: 'pmAmount' })}
                >
                  <span class="value-label">PM</span>
                  <span class="value-amount">
                    {formatQuantity(pmValue, feed.unit) || '—'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* FeedPad drawer for editing */}
      <FeedPad
        isOpen={!!selectedFeed}
        currentValue={getCurrentValue()}
        onValueChange={handleValueChange}
        onClose={() => setSelectedFeed(null)}
        feedName={feedInfo.name}
        unit={feedInfo.unit}
      />
    </div>
  );
}
