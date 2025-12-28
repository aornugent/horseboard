import { useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { FeedPad } from '../../components/FeedPad';
import { formatQuantity } from '@shared/fractions';
import { getHorse, feeds, getFeed, dietByHorse, updateDietAmount, getDietEntry } from '../../stores';
import { upsertDiet } from '../../services/api';
import './HorseDetail.css';

interface HorseDetailProps {
  horseId: string;
  onBack: () => void;
}

interface SelectedFeed {
  feed_id: string;
  field: 'am_amount' | 'pm_amount';
}

export function HorseDetail({ horseId, onBack }: HorseDetailProps) {
  const [selectedFeed, setSelectedFeed] = useState<SelectedFeed | null>(null);

  const horse = getHorse(horseId);

  // Get feeds that have diet entries for this horse
  const activeFeeds = computed(() => {
    const entries = dietByHorse.value.get(horseId) ?? [];
    const activeFeedIds = new Set(
      entries
        .filter((e) => e.am_amount !== null || e.pm_amount !== null)
        .map((e) => e.feed_id)
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
    const entry = getDietEntry(horseId, selectedFeed.feed_id);
    return entry?.[selectedFeed.field] ?? null;
  };

  const handleConfirm = async (value: number | null) => {
    if (!selectedFeed) return;

    // Update local store immediately for optimistic UI
    updateDietAmount(horseId, selectedFeed.feed_id, selectedFeed.field, value);

    // Get current entry to preserve the other field's value
    const currentEntry = getDietEntry(horseId, selectedFeed.feed_id);
    const am_amount = selectedFeed.field === 'am_amount' ? value : currentEntry?.am_amount;
    const pm_amount = selectedFeed.field === 'pm_amount' ? value : currentEntry?.pm_amount;

    // Persist to server
    try {
      await upsertDiet(horseId, selectedFeed.feed_id, am_amount, pm_amount);
    } catch (error) {
      console.error('Failed to save diet entry:', error);
      // TODO: Could add error handling/retry logic here
    }
  };

  const getSelectedFeedInfo = () => {
    if (!selectedFeed) return { name: '', unit: '' };
    const feed = getFeed(selectedFeed.feed_id);
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
          const amValue = entry?.am_amount;
          const pmValue = entry?.pm_amount;

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
                  onClick={() => setSelectedFeed({ feed_id: feed.id, field: 'am_amount' })}
                >
                  <span class="value-label">AM</span>
                  <span class="value-amount">
                    {formatQuantity(amValue ?? null, feed.unit) || '—'}
                  </span>
                </button>

                {/* PM value */}
                <button
                  class="value-button"
                  data-testid={`feed-tile-pm-${feed.id}`}
                  onClick={() => setSelectedFeed({ feed_id: feed.id, field: 'pm_amount' })}
                >
                  <span class="value-label">PM</span>
                  <span class="value-amount">
                    {formatQuantity(pmValue ?? null, feed.unit) || '—'}
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
        onConfirm={handleConfirm}
        onClose={() => setSelectedFeed(null)}
        feedName={feedInfo.name}
        unit={feedInfo.unit}
      />
    </div>
  );
}
