import { board } from '../../stores';
import { canEdit, isAdmin } from '../../hooks/useAppMode';
import { SectionAccount } from './Settings/SectionAccount';
import { SectionDevices } from './Settings/SectionDevices';
import { SectionDisplayDefaults } from './Settings/SectionDisplayDefaults';
import { SectionPermissions, SectionUpgradeAccess } from './Settings/SectionPermissions';


export function SettingsTab() {
  const canEditBoard = canEdit.value;

  if (!board.value) {
    return (
      <div class="tab" data-testid="settings-tab">
        <div class="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div class="tab" data-testid="settings-tab">
      <h2 class="tab-title">Settings</h2>

      <SectionAccount />

      {!canEditBoard && <SectionUpgradeAccess />}

      <section class="section info">
        <h3 class="section-title">Board Info</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Pair Code</span>
            <span class="info-value" data-testid="board-pair-code">
              {board.value.pair_code}
            </span>
          </div>
          <div class="info-item">
            <span class="info-label">Board ID</span>
            <span class="info-value info-value-small" data-testid="board-id">
              {board.value.id.slice(0, 8)}...
            </span>
          </div>
        </div>
      </section>

      {isAdmin.value && (
        <>
          <SectionDevices canEditBoard={canEditBoard} />
          <SectionPermissions />
          <SectionDisplayDefaults />
        </>
      )}
    </div>
  );
}
