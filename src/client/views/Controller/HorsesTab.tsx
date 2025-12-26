import { HorseCard } from '../../components/HorseCard';
import { filteredHorses, searchQuery, countActiveFeeds } from '../../stores';
import './HorsesTab.css';

interface HorsesTabProps {
  onHorseSelect: (horseId: string) => void;
}

export function HorsesTab({ onHorseSelect }: HorsesTabProps) {
  return (
    <div class="horses-tab" data-testid="horses-tab">
      <div class="horses-tab-header">
        <h2 class="horses-tab-title">Horses</h2>
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
    </div>
  );
}
