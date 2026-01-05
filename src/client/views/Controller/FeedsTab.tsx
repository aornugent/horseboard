import { signal, computed } from '@preact/signals';
import { FeedCard } from '../../components/FeedCard';
import { Modal } from '../../components/Modal';
import { feeds, addFeed, removeFeed, updateFeed, board, dietEntries, canEdit } from '../../stores';
import { createFeed as apiCreateFeed, updateFeed as apiUpdateFeed, deleteFeed as apiDeleteFeed } from '../../services';
import { type Feed } from '@shared/resources';
import { type UnitType } from '@shared/unit-strategies';
import './FeedsTab.css';

// Legacy unit definition for UI selection
// Maps user-friendly selection to underlying strategy configuration
const LEGACY_UNITS = [
  { id: 'scoop', label: 'Scoop', type: 'fraction' as UnitType, unitLabel: 'scoop' },
  { id: 'ml', label: 'ML', type: 'decimal' as UnitType, unitLabel: 'ml' },
  { id: 'biscuit', label: 'Biscuit', type: 'int' as UnitType, unitLabel: 'biscuit' },
  { id: 'sachet', label: 'Sachet', type: 'int' as UnitType, unitLabel: 'sachet' },
];

const DEFAULT_UNIT_ID = 'scoop';

const searchQuery = signal('');
const isAddingFeed = signal(false);
const newFeedName = signal('');
const newFeedUnitId = signal<string>(DEFAULT_UNIT_ID);
const editingFeed = signal<Feed | null>(null);
const editingFeedUnitId = signal<string>(DEFAULT_UNIT_ID); // Track unit selection during edit
const deletingFeed = signal<Feed | null>(null);

const filteredFeeds = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return feeds.value;
  return feeds.value.filter(f => f.name.toLowerCase().includes(query));
});

function countHorsesUsingFeed(feedId: string): number {
  return dietEntries.value.filter(
    entry => entry.feed_id === feedId && (entry.am_amount || entry.pm_amount || entry.am_variant || entry.pm_variant)
  ).length;
}

// Helper to find legacy unit ID from feed properties
function getLegacyUnitId(feed: Feed): string {
  // Simple heuristic mapping
  if (feed.unit_type === 'fraction' && feed.unit_label === 'scoop') return 'scoop';
  if (feed.unit_type === 'decimal' && feed.unit_label === 'ml') return 'ml';
  if (feed.unit_type === 'int' && feed.unit_label === 'biscuit') return 'biscuit';
  if (feed.unit_type === 'int' && feed.unit_label === 'sachet') return 'sachet';
  return 'scoop'; // Default fallback
}

async function handleCreateFeed(name: string, unitId: string) {
  if (!board.value) return;

  const unitConfig = LEGACY_UNITS.find(u => u.id === unitId) || LEGACY_UNITS[0];

  try {
    const feed = await apiCreateFeed(
      board.value.id,
      name,
      unitConfig.type,
      unitConfig.unitLabel,
      null
    );
    addFeed(feed);
    isAddingFeed.value = false;
    newFeedName.value = '';
    newFeedUnitId.value = DEFAULT_UNIT_ID;
  } catch (err) {
    console.error('Failed to create feed:', err);
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

async function handleSaveFeedEdit(feed: Feed, unitId: string) {
  const unitConfig = LEGACY_UNITS.find(u => u.id === unitId) || LEGACY_UNITS[0];
  try {
    const updated = await apiUpdateFeed(feed.id, {
      name: feed.name,
      unit_type: unitConfig.type,
      unit_label: unitConfig.unitLabel
    });
    updateFeed(feed.id, updated);
    editingFeed.value = null;
  } catch (err) {
    console.error('Failed to update feed:', err);
  }
}

export function FeedsTab() {
  const canEditBoard = canEdit();

  return (
    <div class="feeds-tab" data-testid="feeds-tab">
      <div class="feeds-tab-header">
        <h2 class="feeds-tab-title">Feeds</h2>
        {canEditBoard && (
          <button
            class="feeds-tab-add-btn"
            data-testid="add-feed-btn"
            onClick={() => { isAddingFeed.value = true; }}
          >
            + Add Feed
          </button>
        )}
      </div>

      <div class="feeds-tab-search">
        <input
          type="search"
          class="feed-search-input"
          placeholder="Search feeds..."
          data-testid="feed-search"
          value={searchQuery.value}
          onInput={(e) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
          }}
        />
      </div>

      <div class="feed-list" data-testid="feed-list">
        {filteredFeeds.value.length === 0 ? (
          <div class="feed-list-empty" data-testid="feed-list-empty">
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
              onEdit={canEditBoard ? () => {
                editingFeed.value = { ...feed };
                editingFeedUnitId.value = getLegacyUnitId(feed);
              } : undefined}
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
        onClose={() => {
          isAddingFeed.value = false;
          newFeedName.value = '';
          newFeedUnitId.value = DEFAULT_UNIT_ID;
        }}
      >
        <div class="modal-field">
          <label class="modal-label">Name</label>
          <input
            type="text"
            class="modal-input"
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
          <div class="unit-selector" data-testid="new-feed-unit">
            {LEGACY_UNITS.map(u => (
              <button
                key={u.id}
                class={`unit-btn ${newFeedUnitId.value === u.id ? 'active' : ''}`}
                data-testid={`unit-btn-${u.id}`}
                onClick={() => { newFeedUnitId.value = u.id; }}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
        <div class="modal-actions">
          <button
            class="modal-btn modal-btn-cancel"
            data-testid="cancel-add-feed"
            onClick={() => {
              isAddingFeed.value = false;
              newFeedName.value = '';
              newFeedUnitId.value = DEFAULT_UNIT_ID;
            }}
          >
            Cancel
          </button>
          <button
            class="modal-btn modal-btn-confirm"
            data-testid="confirm-add-feed"
            disabled={!newFeedName.value.trim()}
            onClick={() => handleCreateFeed(newFeedName.value.trim(), newFeedUnitId.value)}
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
                class="modal-input"
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
              <div class="unit-selector" data-testid="edit-feed-unit">
                {LEGACY_UNITS.map(u => (
                  <button
                    key={u.id}
                    class={`unit-btn ${editingFeedUnitId.value === u.id ? 'active' : ''}`}
                    data-testid={`edit-unit-btn-${u.id}`}
                    onClick={() => {
                      editingFeedUnitId.value = u.id;
                    }}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
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
                disabled={!editingFeed.value.name.trim()}
                onClick={() => editingFeed.value && handleSaveFeedEdit(editingFeed.value, editingFeedUnitId.value)}
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
