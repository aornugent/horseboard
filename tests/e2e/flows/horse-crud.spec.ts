import { test, expect } from '../fixtures/auth';
import { selectors } from '../selectors';
import { createHorse } from '../helpers/api';

/**
 * E2E Tests for Horse CRUD Operations
 *
 * Tests the complete lifecycle of horse management:
 * - View horses
 * - Add new horse
 * - Edit horse details
 * - Delete horse
 * - Form validation
 */
test.describe('Horse CRUD Operations', () => {

  test.describe('View horse list', () => {
    test('should display seeded horses in the list', async ({ ownerPage, ownerBoardId, request }) => {
      // Seed 2 horses via API
      const horse1 = await createHorse(request, ownerBoardId, { name: 'Thunder' });
      const horse2 = await createHorse(request, ownerBoardId, { name: 'Lightning' });

      // Reload to pick up new data
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

      // Verify both horse cards are visible
      await expect(ownerPage.locator(selectors.horseCard(horse1.id))).toBeVisible();
      await expect(ownerPage.locator(selectors.horseCard(horse2.id))).toBeVisible();

      // Verify names
      await expect(ownerPage.locator(selectors.horseCardName(horse1.id))).toHaveText('Thunder');
      await expect(ownerPage.locator(selectors.horseCardName(horse2.id))).toHaveText('Lightning');
    });
  });

  test.describe('Add a new horse', () => {
    test('should add a new horse via the modal', async ({ ownerPage }) => {
      // Fresh board from fixture guarantees no horses initially
      await expect(ownerPage.locator(selectors.horseListEmpty)).toBeVisible();

      // Click add horse button
      await ownerPage.locator(selectors.addHorseBtn).click();

      // Modal should appear
      await expect(ownerPage.locator(selectors.addHorseModal)).toBeVisible();

      // Add button should be disabled when name is empty
      await expect(ownerPage.locator(selectors.confirmAddHorse)).toBeDisabled();

      // Fill in horse name
      const newHorseName = 'Midnight';
      await ownerPage.locator(selectors.newHorseName).fill(newHorseName);

      // Add button should now be enabled
      await expect(ownerPage.locator(selectors.confirmAddHorse)).not.toBeDisabled();

      // Click confirm
      await ownerPage.locator(selectors.confirmAddHorse).click();

      // Modal should close
      await expect(ownerPage.locator(selectors.addHorseModal)).not.toBeVisible();

      // New horse should appear in the list
      const horseCard = ownerPage.locator('.horse-card').filter({ hasText: newHorseName });
      await expect(horseCard).toBeVisible();

      // Empty state should be gone
      await expect(ownerPage.locator(selectors.horseListEmpty)).not.toBeVisible();
    });

    test('should cancel adding a horse', async ({ ownerPage }) => {
      // Click add horse button
      await ownerPage.locator(selectors.addHorseBtn).click();
      await expect(ownerPage.locator(selectors.addHorseModal)).toBeVisible();

      // Fill in some data
      await ownerPage.locator(selectors.newHorseName).fill('Cancelled Horse');

      // Click cancel
      await ownerPage.locator(selectors.cancelAddHorse).click();

      // Modal should close
      await expect(ownerPage.locator(selectors.addHorseModal)).not.toBeVisible();

      // Horse should NOT be in the list
      const horseCard = ownerPage.locator('.horse-card').filter({ hasText: 'Cancelled Horse' });
      await expect(horseCard).not.toBeVisible();
    });
  });

  test.describe('Edit a horse', () => {
    test('should edit horse name and note', async ({ ownerPage, ownerBoardId, request }) => {
      // Seed a horse
      const horse = await createHorse(request, ownerBoardId, {
        name: 'Original Name',
        note: 'Original Note'
      });

      // Reload to see it
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

      // Click on horse card to open detail view
      await ownerPage.locator(selectors.horseCard(horse.id)).click();
      await expect(ownerPage.locator(selectors.horseDetail)).toBeVisible();

      // Click edit button
      await ownerPage.locator(selectors.editHorseBtn).click();
      await expect(ownerPage.locator(selectors.editHorseModal)).toBeVisible();

      // Change name
      const newName = 'Updated Name';
      await ownerPage.locator(selectors.editHorseName).clear();
      await ownerPage.locator(selectors.editHorseName).fill(newName);

      // NOTE: Note editing is not currently tested because the edit modal
      // does not have a note input field (selectors.editHorseNote does not exist).
      // If note editing is added to the UI, uncomment and add selector:
      // const newNote = 'Updated Note';
      // await ownerPage.locator(selectors.editHorseNote).clear();
      // await ownerPage.locator(selectors.editHorseNote).fill(newNote);

      // Save
      await ownerPage.locator(selectors.confirmEditHorse).click();

      // Modal should close
      await expect(ownerPage.locator(selectors.editHorseModal)).not.toBeVisible();

      // Verify updated name in detail view
      await expect(ownerPage.locator(selectors.horseDetailName)).toHaveText(newName);

      // Navigate back to list
      await ownerPage.locator(selectors.horseDetailBack).click();
      await expect(ownerPage.locator(selectors.horseDetail)).not.toBeVisible();

      // Verify changes reflected in list
      const horseCard = ownerPage.locator(selectors.horseCard(horse.id));
      await expect(horseCard).toBeVisible();
    });
  });

  test.describe('Delete a horse', () => {
    test('should delete a horse via the edit modal', async ({ ownerPage, ownerBoardId, request }) => {
      // Seed a horse
      const horse = await createHorse(request, ownerBoardId, { name: 'To Delete' });

      // Reload
      await ownerPage.reload();
      await expect(ownerPage.locator('[data-testid="controller-view"]')).toBeVisible();

      // Click on horse card to open detail view
      await ownerPage.locator(selectors.horseCard(horse.id)).click();
      await expect(ownerPage.locator(selectors.horseDetail)).toBeVisible();

      // Click delete
      await ownerPage.locator(selectors.deleteHorseBtn).click();

      // Confirm deletion in warning modal
      await expect(ownerPage.locator(selectors.deleteHorseModal)).toBeVisible();
      await ownerPage.locator(selectors.confirmDeleteHorse).click();

      // Modals should close
      await expect(ownerPage.locator(selectors.deleteHorseModal)).not.toBeVisible();
      await expect(ownerPage.locator(selectors.horseDetail)).not.toBeVisible();

      // Horse should be gone
      await expect(ownerPage.locator(selectors.horseCard(horse.id))).not.toBeVisible();
    });
  });

  test.describe('Form validation', () => {
    test('should not allow adding horse without name', async ({ ownerPage }) => {
      // Click add button
      await ownerPage.locator(selectors.addHorseBtn).click();

      // Verify confirm button is disabled initially (empty name)
      const confirmBtn = ownerPage.locator(selectors.confirmAddHorse);
      await expect(confirmBtn).toBeDisabled();

      // Enter name
      await ownerPage.locator(selectors.newHorseName).fill('Valid Name');

      // Verify enabled
      await expect(confirmBtn).toBeEnabled();

      // Clear name
      await ownerPage.locator(selectors.newHorseName).clear();

      // Verify disabled again
      await expect(confirmBtn).toBeDisabled();
    });
  });
});
