import { signal, computed } from '@preact/signals';
import { FeedCard } from '../../components/FeedCard/FeedCard';
import { Modal } from '../../components/Modal';
import {
  feeds, addFeed, updateFeed, removeFeed,
  diet, board
} from '../../stores';
import { canEdit } from '../../hooks/useAppMode';
import { createFeed as apiCreateFeed, updateFeed as apiUpdateFeed, deleteFeed as apiDeleteFeed } from '../../services';
import { type Feed } from '@shared/resources';
import { UNIT_TYPE_OPTIONS, UNIT_TYPES, type UnitType } from '@shared/unit-strategies';


// State signals for Add Feed modal
const searchQuery = signal('');
const isAddingFeed = signal(false);
const newFeedName = signal('');
const newFeedType = signal<UnitType>('fraction');
const newFeedLabel = signal<string>('scoop');
const newFeedIsCustom = signal<boolean>(false);

// State signals for Edit Feed modal
const editingFeed = signal<Feed | null>(null);
const editingFeedType = signal<UnitType>('fraction');
const editingFeedLabel = signal<string>('scoop');
const editingFeedIsCustom = signal<boolean>(false);

const deletingFeed = signal<Feed | null>(null);

const filteredFeeds = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return feeds.value;
  return feeds.value.filter(f => f.name.toLowerCase().includes(query));
});

function countHorsesUsingFeed(feedId: string): number {
  return diet.value.filter(
    entry => entry.feed_id === feedId && (entry.am_amount || entry.pm_amount || entry.am_variant || entry.pm_variant)
  ).length;
}

// Helper to check if type/label match a preset
function isPresetUnit(type: UnitType, label: string): boolean {
  return UNIT_TYPE_OPTIONS.some(u => u.type === type && u.unitLabel === label);
}

async function handleCreateFeed(name: string) {
  if (!board.value) {
    alert('DEBUG: board.value is null/undefined');
    return;
  }

  try {
    const feed = await apiCreateFeed(
      board.value.id,
      name,
      newFeedType.value,
      newFeedLabel.value,
      null
    );
    addFeed(feed);
    // Reset state
    isAddingFeed.value = false;
    newFeedName.value = '';
    newFeedType.value = 'fraction';
    newFeedLabel.value = 'scoop';
    newFeedIsCustom.value = false;
  } catch (err) {
    console.error('Failed to create feed:', err);
    alert(`DEBUG: Failed to create feed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleDeleteFeed(id: string) {
  try {
    await apiDeleteFeed(id);
    removeFeed(id);
    deletingFeed.value = null;
  } catch (err) {
    console.error('Failed to delete feed:', err);
  }
}

async function handleSaveFeedEdit(feed: Feed) {
  try {
    const updated = await apiUpdateFeed(feed.id, {
      name: feed.name,
      unit_type: editingFeedType.value,
      unit_label: editingFeedLabel.value
    });
    updateFeed(feed.id, updated);
    editingFeed.value = null;
  } catch (err) {
    console.error('Failed to update feed:', err);
  }
}

function resetAddFeedState() {
  isAddingFeed.value = false;
  newFeedName.value = '';
  newFeedType.value = 'fraction';
  newFeedLabel.value = 'scoop';
  newFeedIsCustom.value = false;
}

function openEditFeed(feed: Feed) {
  editingFeed.value = { ...feed };
  editingFeedType.value = feed.unit_type;
  editingFeedLabel.value = feed.unit_label;
  editingFeedIsCustom.value = !isPresetUnit(feed.unit_type, feed.unit_label);
}

// Determine if confirm button should be disabled (computed signals for reactivity)
const isAddDisabled = computed(() =>
  !newFeedName.value.trim() ||
  (newFeedIsCustom.value && !newFeedLabel.value.trim()));
const isEditDisabled = computed(() =>
  !editingFeed.value?.name.trim() ||
  (editingFeedIsCustom.value && !editingFeedLabel.value.trim()));

export function FeedsTab() {
  const canEditBoard = canEdit.value;


  return (
    <div class="tab" data-testid="feeds-tab">
      <div class="tab-header">
        <h2 class="tab-title">Feeds</h2>
        {canEditBoard && (
          <button
            class="btn"
            data-testid="add-feed-btn"
            onClick={() => { isAddingFeed.value = true; }}
          >
            + Add Feed
          </button>
        )}
      </div>

      <div class="tab-search">
        <input
          type="search"
          class="input"
          placeholder="Search feeds..."
          data-testid="feed-search"
          value={searchQuery.value}
          onInput={(e) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
          }}
        />
      </div>

      <div class="tab-list" data-testid="feed-list">
        {filteredFeeds.value.length === 0 ? (
          <div class="tab-list-empty" data-testid="feed-list-empty">
            {searchQuery.value
              ? 'No feeds match your search'
              : 'No feeds yet. Add one to get started!'}
          </div>
        ) : (
          filteredFeeds.value.map((feed) => (
            <FeedCard
              key={feed.id}
              feed={feed}
              horseCount={countHorsesUsingFeed(feed.id)}
              onEdit={canEditBoard ? () => openEditFeed(feed) : undefined}
              onDelete={canEditBoard ? () => { deletingFeed.value = feed; } : undefined}
            />
          ))
        )}
      </div>

      {/* Add Feed Modal */}
      <Modal
        isOpen={isAddingFeed.value}
        title="Add New Feed"
        data-testid="add-feed-modal"
        onClose={resetAddFeedState}
      >
        <div class="modal-field">
          <label class="modal-label">Name</label>
          <input
            type="text"
            class="input"
            data-testid="new-feed-name"
            placeholder="Feed name..."
            value={newFeedName.value}
            onInput={(e) => {
              newFeedName.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="modal-field">
          <label class="modal-label">Unit</label>
          <div class="segmented-control" data-testid="new-feed-unit">
            {UNIT_TYPE_OPTIONS.map(u => (
              <button
                key={u.id}
                class={`segment-btn ${!newFeedIsCustom.value && newFeedType.value === u.type && newFeedLabel.value === u.unitLabel ? 'active' : ''}`}
                data-testid={`unit-btn-${u.id}`}
                onClick={() => {
                  newFeedType.value = u.type;
                  newFeedLabel.value = u.unitLabel;
                  newFeedIsCustom.value = false;
                }}
              >
                {u.label}
              </button>
            ))}
            <button
              class={`segment-btn ${newFeedIsCustom.value ? 'active' : ''}`}
              data-testid="unit-btn-custom"
              onClick={() => {
                newFeedIsCustom.value = true;
                // Reset to defaults for custom
                newFeedType.value = 'fraction';
                newFeedLabel.value = '';
              }}
            >
              Custom
            </button>
          </div>
        </div>
        {newFeedIsCustom.value && (
          <>
            <div class="modal-field">
              <label class="modal-label">Type</label>
              <div class="segmented-control" data-testid="custom-type-selector">
                {UNIT_TYPES.map(type => (
                  <button
                    key={type}
                    class={`segment-btn ${newFeedType.value === type ? 'active' : ''}`}
                    data-testid={`custom-type-${type}`}
                    onClick={() => { newFeedType.value = type; }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div class="modal-field">
              <label class="modal-label">Label</label>
              <input
                type="text"
                class="input"
                data-testid="custom-label-input"
                placeholder="e.g., grams, tablets..."
                value={newFeedLabel.value}
                onInput={(e) => {
                  newFeedLabel.value = (e.target as HTMLInputElement).value;
                }}
              />
            </div>
          </>
        )}
        <div class="modal-actions">
          <button
            class="modal-btn modal-btn-cancel"
            data-testid="cancel-add-feed"
            onClick={resetAddFeedState}
          >
            Cancel
          </button>
          <button
            class="modal-btn modal-btn-confirm"
            data-testid="confirm-add-feed"
            disabled={!newFeedName.value.trim() || (newFeedIsCustom.value && !newFeedLabel.value.trim())}
            onClick={() => handleCreateFeed(newFeedName.value.trim())}
          >
            Add Feed
          </button>
        </div>
      </Modal>

      {/* Edit Feed Modal */}
      <Modal
        isOpen={!!editingFeed.value}
        title="Edit Feed"
        data-testid="edit-feed-modal"
        onClose={() => { editingFeed.value = null; }}
      >
        {editingFeed.value && (
          <>
            <div class="modal-field">
              <label class="modal-label">Name</label>
              <input
                type="text"
                class="input"
                data-testid="edit-feed-name"
                value={editingFeed.value.name}
                onInput={(e) => {
                  if (editingFeed.value) {
                    editingFeed.value = {
                      ...editingFeed.value,
                      name: (e.target as HTMLInputElement).value,
                    };
                  }
                }}
              />
            </div>
            <div class="modal-field">
              <label class="modal-label">Unit</label>
              <div class="segmented-control" data-testid="edit-feed-unit">
                {UNIT_TYPE_OPTIONS.map(u => (
                  <button
                    key={u.id}
                    class={`segment-btn ${!editingFeedIsCustom.value && editingFeedType.value === u.type && editingFeedLabel.value === u.unitLabel ? 'active' : ''}`}
                    data-testid={`edit-unit-btn-${u.id}`}
                    onClick={() => {
                      editingFeedType.value = u.type;
                      editingFeedLabel.value = u.unitLabel;
                      editingFeedIsCustom.value = false;
                    }}
                  >
                    {u.label}
                  </button>
                ))}
                <button
                  class={`segment-btn ${editingFeedIsCustom.value ? 'active' : ''}`}
                  data-testid="unit-btn-custom"
                  onClick={() => {
                    editingFeedIsCustom.value = true;
                  }}
                >
                  Custom
                </button>
              </div>
            </div>
            {editingFeedIsCustom.value && (
              <>
                <div class="modal-field">
                  <label class="modal-label">Type</label>
                  <div class="segmented-control" data-testid="edit-custom-type-selector">
                    {UNIT_TYPES.map(type => (
                      <button
                        key={type}
                        class={`segment-btn ${editingFeedType.value === type ? 'active' : ''}`}
                        data-testid={`custom-type-${type}`}
                        onClick={() => { editingFeedType.value = type; }}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div class="modal-field">
                  <label class="modal-label">Label</label>
                  <input
                    type="text"
                    class="input"
                    data-testid="custom-label-input"
                    placeholder="e.g., grams, tablets..."
                    value={editingFeedLabel.value}
                    onInput={(e) => {
                      editingFeedLabel.value = (e.target as HTMLInputElement).value;
                    }}
                  />
                </div>
              </>
            )}
            <div class="modal-actions">
              <button
                class="modal-btn modal-btn-cancel"
                data-testid="cancel-edit-feed"
                onClick={() => { editingFeed.value = null; }}
              >
                Cancel
              </button>
              <button
                class="modal-btn modal-btn-confirm"
                data-testid="confirm-edit-feed"
                disabled={!editingFeed.value?.name.trim() || (editingFeedIsCustom.value && !editingFeedLabel.value.trim())}
                onClick={() => editingFeed.value && handleSaveFeedEdit(editingFeed.value)}
              >
                Save Changes
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingFeed.value}
        title="Delete Feed?"
        data-testid="delete-feed-modal"
        onClose={() => { deletingFeed.value = null; }}
      >
        {deletingFeed.value && (
          <>
            <p class="modal-description">
              Are you sure you want to delete <strong>{deletingFeed.value.name}</strong>?
              This will also remove it from all horse diets.
            </p>
            <div class="modal-actions">
              <button
                class="modal-btn modal-btn-cancel"
                data-testid="cancel-delete-feed"
                onClick={() => { deletingFeed.value = null; }}
              >
                Cancel
              </button>
              <button
                class="modal-btn modal-btn-danger"
                data-testid="confirm-delete-feed"
                onClick={() => deletingFeed.value && handleDeleteFeed(deletingFeed.value.id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
