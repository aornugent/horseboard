import { signal, computed } from '@preact/signals';
import { FeedCard } from '../../components/FeedCard';
import { feeds, addFeed, removeFeed, updateFeed, display, dietEntries } from '../../stores';
import type { Feed } from '@shared/resources';
import './FeedsTab.css';

// Local UI state
const searchQuery = signal('');
const isAddingFeed = signal(false);
const newFeedName = signal('');
const newFeedUnit = signal<'scoop' | 'ml' | 'sachet' | 'biscuit'>('scoop');
const editingFeed = signal<Feed | null>(null);
const deletingFeed = signal<Feed | null>(null);

// Filtered feeds based on search
const filteredFeeds = computed(() => {
  const query = searchQuery.value.toLowerCase();
  if (!query) return feeds.value;
  return feeds.value.filter(f => f.name.toLowerCase().includes(query));
});

// Count horses using a specific feed
function countHorsesUsingFeed(feedId: string): number {
  return dietEntries.value.filter(
    entry => entry.feedId === feedId && (entry.amAmount || entry.pmAmount)
  ).length;
}

// API helpers
async function createFeed(name: string, unit: 'scoop' | 'ml' | 'sachet' | 'biscuit') {
  if (!display.value) return;

  const response = await fetch(`/api/displays/${display.value.id}/feeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, unit }),
  });

  if (response.ok) {
    const { data } = await response.json();
    addFeed(data);
    isAddingFeed.value = false;
    newFeedName.value = '';
    newFeedUnit.value = 'scoop';
  }
}

async function deleteFeed(id: string) {
  const response = await fetch(`/api/feeds/${id}`, { method: 'DELETE' });

  if (response.ok) {
    removeFeed(id);
    deletingFeed.value = null;
  }
}

async function saveFeedEdit(feed: Feed) {
  const response = await fetch(`/api/feeds/${feed.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: feed.name, unit: feed.unit }),
  });

  if (response.ok) {
    const { data } = await response.json();
    updateFeed(feed.id, data);
    editingFeed.value = null;
  }
}

const UNITS: Array<{ value: 'scoop' | 'ml' | 'sachet' | 'biscuit'; label: string }> = [
  { value: 'scoop', label: 'Scoop' },
  { value: 'ml', label: 'ml' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'biscuit', label: 'Biscuit' },
];

export function FeedsTab() {
  return (
    <div class="feeds-tab" data-testid="feeds-tab">
      <div class="feeds-tab-header">
        <h2 class="feeds-tab-title">Feeds</h2>
        <button
          class="feeds-tab-add-btn"
          data-testid="add-feed-btn"
          onClick={() => { isAddingFeed.value = true; }}
        >
          + Add Feed
        </button>
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
              onEdit={() => { editingFeed.value = { ...feed }; }}
              onDelete={() => { deletingFeed.value = feed; }}
            />
          ))
        )}
      </div>

      {/* Add Feed Modal */}
      {isAddingFeed.value && (
        <div class="modal-overlay" data-testid="add-feed-modal">
          <div class="modal-content">
            <h3 class="modal-title">Add New Feed</h3>
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
                {UNITS.map(u => (
                  <button
                    key={u.value}
                    class={`unit-btn ${newFeedUnit.value === u.value ? 'active' : ''}`}
                    data-testid={`unit-btn-${u.value}`}
                    onClick={() => { newFeedUnit.value = u.value; }}
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
                  newFeedUnit.value = 'scoop';
                }}
              >
                Cancel
              </button>
              <button
                class="modal-btn modal-btn-confirm"
                data-testid="confirm-add-feed"
                disabled={!newFeedName.value.trim()}
                onClick={() => createFeed(newFeedName.value.trim(), newFeedUnit.value)}
              >
                Add Feed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Feed Modal */}
      {editingFeed.value && (
        <div class="modal-overlay" data-testid="edit-feed-modal">
          <div class="modal-content">
            <h3 class="modal-title">Edit Feed</h3>
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
                {UNITS.map(u => (
                  <button
                    key={u.value}
                    class={`unit-btn ${editingFeed.value?.unit === u.value ? 'active' : ''}`}
                    data-testid={`edit-unit-btn-${u.value}`}
                    onClick={() => {
                      if (editingFeed.value) {
                        editingFeed.value = { ...editingFeed.value, unit: u.value };
                      }
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
                onClick={() => editingFeed.value && saveFeedEdit(editingFeed.value)}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingFeed.value && (
        <div class="modal-overlay" data-testid="delete-feed-modal">
          <div class="modal-content">
            <h3 class="modal-title">Delete Feed?</h3>
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
                onClick={() => deletingFeed.value && deleteFeed(deletingFeed.value.id)}
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
