import { signal, computed } from '@preact/signals';
import { getEffectiveTimeMode, getTimeModeForHour } from '@shared/time-mode';
import { formatQuantity } from '@shared/fractions';
import type { TimeMode } from '@shared/types';

// Demo state using shared logic
const configuredMode = signal<TimeMode>('AUTO');
const timezone = signal('Australia/Sydney');

// Computed effective time mode using shared logic
const effectiveTimeMode = computed(() => {
  return getEffectiveTimeMode(configuredMode.value, null, timezone.value);
});

// Demo quantities to show fraction formatting
const demoQuantities = [0.25, 0.5, 1, 1.5, 2.75, null, 0];

export function App() {
  return (
    <div data-theme={effectiveTimeMode.value.toLowerCase()}>
      <h1>HorseBoard V3</h1>
      <p>Preact + Signals + Shared Kernel ready</p>

      <section style={{ marginTop: '1rem' }}>
        <h2>Time Mode (shared logic)</h2>
        <p>Configured: {configuredMode.value}</p>
        <p>Effective: {effectiveTimeMode.value}</p>
        <p>Current hour mode: {getTimeModeForHour(new Date().getHours())}</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button onClick={() => (configuredMode.value = 'AUTO')}>AUTO</button>
          <button onClick={() => (configuredMode.value = 'AM')}>AM</button>
          <button onClick={() => (configuredMode.value = 'PM')}>PM</button>
        </div>
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2>Fraction Formatting (shared logic)</h2>
        <ul>
          {demoQuantities.map((qty, i) => (
            <li key={i}>
              {String(qty)} → "{formatQuantity(qty)}"
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
