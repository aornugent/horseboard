import { useState } from 'preact/hooks';
import { signal, computed } from '@preact/signals';
import { FeedPad } from '../../components/FeedPad/FeedPad';
import { getStrategyForType, parseEntryOptions } from '@shared/unit-strategies';
import {
  horses, feeds, getHorse, updateHorse, removeHorse,
  diet, getDiet, getDietByHorse, updateDietAmount,
  getFeed, canEdit
} from '../../stores';
import { updateHorse as apiUpdateHorse, deleteHorse as apiDeleteHorse, upsertDiet } from '../../services/api';


interface HorseDetailProps {
  horseId: string;
  onBack: () => void;
}

interface SelectedFeed {
  feed_id: string;
  field: 'am_amount' | 'pm_amount';
}

const isEditing = signal(false);
const editName = signal('');
const isDeleting = signal(false);

export function HorseDetail({ horseId, onBack }: HorseDetailProps) {
  const [selectedFeed, setSelectedFeed] = useState<SelectedFeed | null>(null);
  const canEditBoard = canEdit();

  const horse = getHorse(horseId);

  const activeFeeds = computed(() => {
    const entries = getDietByHorse(horseId);
    const activeFeedIds = new Set(
      entries
        .filter((e) => e.am_amount !== null || e.pm_amount !== null || !!e.am_variant || !!e.pm_variant)
        .map((e) => e.feed_id)
    );

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
    const entry = getDiet(horseId, selectedFeed.feed_id);
    return entry?.[selectedFeed.field] ?? null;
  };

  const getCurrentVariant = (): string | null => {
    if (!selectedFeed) return null;
    const entry = getDiet(horseId, selectedFeed.feed_id);
    return selectedFeed.field === 'am_amount' ? entry?.am_variant ?? null : entry?.pm_variant ?? null;
  };

  const handleConfirm = async (value: number | null, variant: string | null) => {
    if (!selectedFeed) return;


    updateDietAmount(horseId, selectedFeed.feed_id, selectedFeed.field, value);

    const currentEntry = getDiet(horseId, selectedFeed.feed_id);
    const am_amount = selectedFeed.field === 'am_amount' ? value : currentEntry?.am_amount;
    const pm_amount = selectedFeed.field === 'pm_amount' ? value : currentEntry?.pm_amount;
    const am_variant = selectedFeed.field === 'am_amount' ? variant : currentEntry?.am_variant;
    const pm_variant = selectedFeed.field === 'pm_amount' ? variant : currentEntry?.pm_variant;

    try {
      await upsertDiet(horseId, selectedFeed.feed_id, am_amount, pm_amount, am_variant, pm_variant);
    } catch (error) {
      console.error('Failed to save diet entry:', error);
      alert('Failed to save changes. Please check your connection and try again.');
    }
  };

  const getSelectedFeedInfo = () => {
    if (!selectedFeed) return { name: '', unitType: 'fraction' as const, unitLabel: 'scoop', entryOptions: null };
    const feed = getFeed(selectedFeed.feed_id);
    return {
      name: feed?.name ?? '',
      unitType: feed?.unit_type ?? 'fraction',
      unitLabel: feed?.unit_label ?? 'scoop',
      entryOptions: feed?.entry_options ?? null,
    };
  };

  const handleOpenEdit = () => {
    editName.value = horse.name;
    isEditing.value = true;
  };

  const handleSaveEdit = async () => {
    const newName = editName.value.trim();
    if (!newName) return;

    try {
      const updated = await apiUpdateHorse(horseId, { name: newName });
      updateHorse(horseId, updated);
      isEditing.value = false;
    } catch (err) {
      console.error('Failed to update horse:', err);
    }
  };

  const handleCancelEdit = () => {
    isEditing.value = false;
    editName.value = '';
  };

  const handleOpenDelete = () => {
    isDeleting.value = true;
  };

  const handleConfirmDelete = async () => {
    try {
      await apiDeleteHorse(horseId);
      removeHorse(horseId);
      isDeleting.value = false;
      onBack();
    } catch (err) {
      console.error('Failed to delete horse:', err);
    }
  };

  const handleCancelDelete = () => {
    isDeleting.value = false;
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
        <div class="horse-detail-actions">
          {canEditBoard && (
            <>
              <button
                class="horse-detail-action-btn"
                data-testid="edit-horse-btn"
                onClick={handleOpenEdit}
                aria-label="Edit horse"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                class="horse-detail-action-btn horse-detail-action-btn-danger"
                data-testid="delete-horse-btn"
                onClick={handleOpenDelete}
                aria-label="Delete horse"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {horse.note && (
        <div class="horse-detail-note" data-testid="horse-detail-note">
          <span class="note-label">Note:</span> {horse.note}
        </div>
      )}

      <div class="feed-tiles" data-testid="feed-tiles">
        {activeFeeds.value.map((feed) => {
          const entry = getDiet(horseId, feed.id);
          const amValue = entry?.am_amount;
          const pmValue = entry?.pm_amount;

          const strategy = getStrategyForType(feed.unit_type);
          const options = parseEntryOptions(feed.entry_options, feed.unit_type);
          const amDisplay = strategy.formatDisplay(amValue ?? null, entry?.am_variant ?? null, options, feed.unit_label) || '—';
          const pmDisplay = strategy.formatDisplay(pmValue ?? null, entry?.pm_variant ?? null, options, feed.unit_label) || '—';

          return (
            <div
              key={feed.id}
              class="feed-tile"
              data-testid={`feed-tile-${feed.id}`}
            >
              <div class="feed-tile-header">
                <span class="feed-tile-name">{feed.name}</span>
                <span class="feed-tile-unit">{feed.unit_label}</span>
              </div>
              <div class="feed-tile-values">
                <button
                  class="value-button"
                  data-testid={`feed-tile-am-${feed.id}`}
                  onClick={() => canEditBoard && setSelectedFeed({ feed_id: feed.id, field: 'am_amount' })}
                  disabled={!canEditBoard}
                >
                  <span class="value-label">AM</span>
                  <span class="value-amount">
                    {amDisplay}
                  </span>
                </button>

                <button
                  class="value-button"
                  data-testid={`feed-tile-pm-${feed.id}`}
                  onClick={() => canEditBoard && setSelectedFeed({ feed_id: feed.id, field: 'pm_amount' })}
                  disabled={!canEditBoard}
                >
                  <span class="value-label">PM</span>
                  <span class="value-amount">
                    {pmDisplay}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <FeedPad
        isOpen={!!selectedFeed}
        currentValue={getCurrentValue()}
        currentVariant={getCurrentVariant()}
        onConfirm={handleConfirm}
        onClose={() => setSelectedFeed(null)}
        feedName={feedInfo.name}
        unitType={feedInfo.unitType}
        unitLabel={feedInfo.unitLabel}
        entryOptions={feedInfo.entryOptions}
      />

      {isEditing.value && (
        <div class="modal-overlay open" data-testid="edit-horse-modal">
          <div class="modal-content">
            <h3 class="modal-title">Edit Horse</h3>
            <div class="modal-field">
              <label class="modal-label">Name</label>
              <input
                type="text"
                class="modal-input"
                data-testid="edit-horse-name"
                value={editName.value}
                onInput={(e) => {
                  editName.value = (e.target as HTMLInputElement).value;
                }}
              />
            </div>
            <div class="modal-actions">
              <button
                class="modal-btn modal-btn-cancel"
                data-testid="cancel-edit-horse"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button
                class="modal-btn modal-btn-confirm"
                data-testid="confirm-edit-horse"
                disabled={!editName.value.trim()}
                onClick={handleSaveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleting.value && (
        <div class="modal-overlay open" data-testid="delete-horse-modal">
          <div class="modal-content">
            <h3 class="modal-title">Delete Horse?</h3>
            <p class="modal-description">
              Are you sure you want to delete <strong>{horse.name}</strong>?
              This will also remove all their diet entries.
            </p>
            <div class="modal-actions">
              <button
                class="modal-btn modal-btn-cancel"
                data-testid="cancel-delete-horse"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                class="modal-btn modal-btn-danger"
                data-testid="confirm-delete-horse"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
