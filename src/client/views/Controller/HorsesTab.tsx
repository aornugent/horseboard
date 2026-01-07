import { signal } from '@preact/signals';
import { HorseCard } from '../../components/HorseCard/HorseCard';
import { Modal } from '../../components/Modal';
import { horseStore, dietStore, boardStore, canEdit } from '../../stores';
import { createHorse as apiCreateHorse } from '../../services';


interface HorsesTabProps {
  onHorseSelect: (horseId: string) => void;
}

const isAddingHorse = signal(false);
const newHorseName = signal('');
const newHorseNote = signal('');

async function handleCreateHorse(name: string, note: string) {
  if (!boardStore.board.value) return;

  try {
    const horse = await apiCreateHorse(boardStore.board.value.id, name, note || null);
    horseStore.add(horse);
    isAddingHorse.value = false;
    newHorseName.value = '';
    newHorseNote.value = '';
  } catch (err) {
    console.error('Failed to create horse:', err);
  }
}

export function HorsesTab({ onHorseSelect }: HorsesTabProps) {
  const canEditBoard = canEdit();

  return (
    <div class="tab" data-testid="horses-tab">
      <div class="tab-header">
        <h2 class="tab-title">Horses</h2>
        {canEditBoard && (
          <button
            class="btn"
            data-testid="add-horse-btn"
            onClick={() => { isAddingHorse.value = true; }}
          >
            + Add Horse
          </button>
        )}
      </div>

      <div class="tab-search">
        <input
          type="search"
          class="input"
          placeholder="Search horses..."
          data-testid="horse-search"
          value={horseStore.searchQuery.value}
          onInput={(e) => {
            horseStore.searchQuery.value = (e.target as HTMLInputElement).value;
          }}
        />
      </div>

      <div class="tab-list" data-testid="horse-list">
        {horseStore.filtered.value.length === 0 ? (
          <div class="tab-list-empty" data-testid="horse-list-empty">
            {horseStore.searchQuery.value
              ? 'No horses match your search'
              : 'No horses yet. Add one to get started!'}
          </div>
        ) : (
          horseStore.filtered.value.map((horse) => (
            <HorseCard
              key={horse.id}
              horse={horse}
              feedCount={dietStore.countActiveFeeds(horse.id)}
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
