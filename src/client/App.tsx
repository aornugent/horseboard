import { signal } from '@preact/signals';

const timeMode = signal<'AM' | 'PM'>('AM');

export function App() {
  return (
    <div data-theme={timeMode.value.toLowerCase()}>
      <h1>HorseBoard V3</h1>
      <p>Preact + Signals scaffold ready</p>
      <p>Current time mode: {timeMode.value}</p>
      <button onClick={() => (timeMode.value = timeMode.value === 'AM' ? 'PM' : 'AM')}>
        Toggle Time Mode
      </button>
    </div>
  );
}
