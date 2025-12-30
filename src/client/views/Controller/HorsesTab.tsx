import { signal } from '@preact/signals';
import { HorseCard } from '../../components/HorseCard';
import { Modal } from '../../components/Modal';
import { filteredHorses, searchQuery, countActiveFeeds, addHorse, board } from '../../stores';
import { createHorse as apiCreateHorse } from '../../services';
import './HorsesTab.css';

interface HorsesTabProps {
  onHorseSelect: (horseId: string) => void;
}

const isAddingHorse = signal(false);
const newHorseName = signal('');
const newHorseNote = signal('');

async function handleCreateHorse(name: string, note: string) {
  if (!board.value) return;

  try {
    const horse = await apiCreateHorse(board.value.id, name, note || null);
    addHorse(horse);
    isAddingHorse.value = false;
    newHorseName.value = '';
    newHorseNote.value = '';
  } catch (err) {
    console.error('Failed to create horse:', err);
  }
}

export function HorsesTab({ onHorseSelect }: HorsesTabProps) {
  return (
    <div class="horses-tab" data-testid="horses-tab">
      <div class="horses-tab-header">
        <h2 class="horses-tab-title">Horses</h2>
        <button
          class="horses-tab-add-btn"
          data-testid="add-horse-btn"
          onClick={() => { isAddingHorse.value = true; }}
        >
          + Add Horse
        </button>
      </div>

      <div class="horses-tab-search">
        <input
          type="search"
          class="horse-search-input"
          placeholder="Search horses..."
          data-testid="horse-search"
          value={searchQuery.value}
          onInput={(e) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
          }}
        />
      </div>

      <div class="horse-list" data-testid="horse-list">
        {filteredHorses.value.length === 0 ? (
          <div class="horse-list-empty" data-testid="horse-list-empty">
            {searchQuery.value
              ? 'No horses match your search'
              : 'No horses yet. Add one to get started!'}
          </div>
        ) : (
          filteredHorses.value.map((horse) => (
            <HorseCard
              key={horse.id}
              horse={horse}
              feedCount={countActiveFeeds(horse.id)}
              onClick={() => onHorseSelect(horse.id)}
            />
          ))
        )}
      </div>

      <Modal
        isOpen={isAddingHorse.value}
        title="Add New Horse"
        onClose={() => {
          isAddingHorse.value = false;
          newHorseName.value = '';
          newHorseNote.value = '';
        }}
        data-testid="add-horse-modal"
      >
        <div class="modal-field">
          <label class="modal-label">Name</label>
          <input
            type="text"
            class="modal-input"
            data-testid="new-horse-name"
            placeholder="Horse name..."
            value={newHorseName.value}
            onInput={(e) => {
              newHorseName.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="modal-field">
          <label class="modal-label">Note (optional)</label>
          <input
            type="text"
            class="modal-input"
            data-testid="new-horse-note"
            placeholder="Any notes about this horse..."
            value={newHorseNote.value}
            onInput={(e) => {
              newHorseNote.value = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="modal-actions">
          <button
            class="modal-btn modal-btn-cancel"
            data-testid="cancel-add-horse"
            onClick={() => {
              isAddingHorse.value = false;
              newHorseName.value = '';
              newHorseNote.value = '';
            }}
          >
            Cancel
          </button>
          <button
            class="modal-btn modal-btn-confirm"
            data-testid="confirm-add-horse"
            disabled={!newHorseName.value.trim()}
            onClick={() => handleCreateHorse(newHorseName.value.trim(), newHorseNote.value.trim())}
          >
            Add Horse
          </button>
        </div>
      </Modal>
    </div>
  );
}
