import { test, expect } from '@playwright/test';
import { selectors } from '../selectors';
import {
  seedTestData,
  cleanupTestData,
  navigateWithBoard,
  waitForControllerReady,
  type TestData,
} from '../helpers/setup';
import { createHorse } from '../helpers/api';

/**
 * E2E Tests for Horse CRUD Operations
 *
 * Tests the complete lifecycle of horse management:
 * - View horse list
 * - Add a new horse
 * - View horse detail
 * - Edit horse name (MISSING UI - documented below)
 * - Delete a horse (MISSING UI - documented below)
 *
 * Each test creates its own isolated data via API to ensure determinism.
 */

test.describe('Horse CRUD Operations', () => {
  let testData: TestData;

  test.afterEach(async ({ request }) => {
    // Clean up test data
    if (testData?.board?.id) {
      await cleanupTestData(request, testData.board.id);
    }
  });

  test.describe('View horse list', () => {
    test('should display seeded horses in the list', async ({ page, request }) => {
      // Seed 2 horses
      testData = await seedTestData(page, request, {
        horseCount: 2,
        feedCount: 0,
        createDietEntries: false,
      });

      // Navigate to controller (Horses tab is default)
      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      // Verify both horse cards are visible with correct names
      const horse1 = testData.horses[0];
      const horse2 = testData.horses[1];

      const horseCard1 = page.locator(selectors.horseCard(horse1.id));
      const horseCard2 = page.locator(selectors.horseCard(horse2.id));

      await expect(horseCard1).toBeVisible();
      await expect(horseCard2).toBeVisible();

      // Verify names
      await expect(page.locator(selectors.horseCardName(horse1.id))).toHaveText(horse1.name);
      await expect(page.locator(selectors.horseCardName(horse2.id))).toHaveText(horse2.name);
    });
  });

  test.describe('Add a new horse', () => {
    test('should add a new horse via the modal', async ({ page, request }) => {
      // Seed empty board (no horses)
      testData = await seedTestData(page, request, {
        horseCount: 0,
        feedCount: 0,
        createDietEntries: false,
      });

      // Navigate to controller
      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      // Verify empty state initially
      await expect(page.locator(selectors.horseListEmpty)).toBeVisible();

      // Click add horse button
      await page.locator(selectors.addHorseBtn).click();

      // Modal should appear
      await expect(page.locator(selectors.addHorseModal)).toBeVisible();

      // Add button should be disabled when name is empty
      await expect(page.locator(selectors.confirmAddHorse)).toBeDisabled();

      // Fill in horse name
      const newHorseName = 'Midnight';
      await page.locator(selectors.newHorseName).fill(newHorseName);

      // Add button should now be enabled
      await expect(page.locator(selectors.confirmAddHorse)).not.toBeDisabled();

      // Click confirm
      await page.locator(selectors.confirmAddHorse).click();

      // Modal should close
      await expect(page.locator(selectors.addHorseModal)).not.toBeVisible();

      // New horse should appear in the list
      const horseCard = page.locator('.horse-card').filter({ hasText: newHorseName });
      await expect(horseCard).toBeVisible();

      // Empty state should be gone
      await expect(page.locator(selectors.horseListEmpty)).not.toBeVisible();
    });

    test('should cancel adding a horse', async ({ page, request }) => {
      // Seed empty board
      testData = await seedTestData(page, request, {
        horseCount: 0,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      // Open add modal
      await page.locator(selectors.addHorseBtn).click();
      await expect(page.locator(selectors.addHorseModal)).toBeVisible();

      // Fill in name
      await page.locator(selectors.newHorseName).fill('Test Horse');

      // Cancel
      await page.locator(selectors.cancelAddHorse).click();

      // Modal should close
      await expect(page.locator(selectors.addHorseModal)).not.toBeVisible();

      // No horse should be added
      await expect(page.locator(selectors.horseListEmpty)).toBeVisible();
    });

    test('should add a horse with a note', async ({ page, request }) => {
      testData = await seedTestData(page, request, {
        horseCount: 0,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      // Open add modal
      await page.locator(selectors.addHorseBtn).click();

      // Fill in name and note
      const horseName = 'Spirit';
      const horseNote = 'New arrival from the farm';
      await page.locator(selectors.newHorseName).fill(horseName);
      await page.locator(selectors.newHorseNote).fill(horseNote);

      // Confirm
      await page.locator(selectors.confirmAddHorse).click();

      // Horse should appear in list with note
      const horseCard = page.locator('.horse-card').filter({ hasText: horseName });
      await expect(horseCard).toBeVisible();

      // Note should be visible on the card
      const noteElement = horseCard.locator('.horse-card-note');
      await expect(noteElement).toContainText(horseNote);
    });
  });

  test.describe('View horse detail', () => {
    test('should show horse name and note in detail view', async ({ page, request }) => {
      // Seed 1 horse with a note via API
      testData = await seedTestData(page, request, {
        horseCount: 0,
        feedCount: 1,
        createDietEntries: false,
      });

      // Create horse with note
      const horseWithNote = await createHorse(request, testData.board.id, {
        name: 'Starlight',
        note: 'Needs extra care',
      });
      testData.horses.push(horseWithNote);

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      // Click on the horse card
      await page.locator(selectors.horseCard(horseWithNote.id)).click();

      // Detail view should appear
      await expect(page.locator(selectors.horseDetail)).toBeVisible();

      // Verify name
      await expect(page.locator(selectors.horseDetailName)).toHaveText(horseWithNote.name);

      // Verify note
      await expect(page.locator(selectors.horseDetailNote)).toContainText(horseWithNote.note!);
    });

    test('should navigate back from detail to list', async ({ page, request }) => {
      testData = await seedTestData(page, request, {
        horseCount: 1,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      // Click on horse card
      const horse = testData.horses[0];
      await page.locator(selectors.horseCard(horse.id)).click();

      // Detail view should show
      await expect(page.locator(selectors.horseDetail)).toBeVisible();

      // Click back button
      await page.locator(selectors.horseDetailBack).click();

      // Should be back at the list
      await expect(page.locator(selectors.horseList)).toBeVisible();
      await expect(page.locator(selectors.horseCard(horse.id))).toBeVisible();
    });
  });

  /**
   * MISSING FEATURE: Edit horse name
   *
   * The API supports updating horses via PATCH /api/horses/:id
   * (see TECHNICAL_SPECIFICATION.md section 5.1), but the controller
   * UI does not currently provide a way to edit horse details.
   *
   * The HorseDetail component (src/client/views/Controller/HorseDetail.tsx)
   * only displays the horse name and note - it has no edit button or
   * inline editing capability.
   *
   * To implement this feature, the UI would need:
   * - An edit button on HorseDetail (data-testid="edit-horse-btn")
   * - An edit modal with name/note inputs (data-testid="edit-horse-modal")
   * - Save/cancel buttons for the edit
   */
  test.describe('Edit horse name', () => {
    test.skip('UI NOT IMPLEMENTED: should edit horse name via modal', async () => {
      // This test is skipped because the edit UI doesn't exist.
      // The API supports PATCH /api/horses/:id but there's no UI for it.
      //
      // Expected flow when implemented:
      // 1. Navigate to horse detail
      // 2. Click edit button (data-testid="edit-horse-btn")
      // 3. Modal opens with current name (data-testid="edit-horse-modal")
      // 4. Change name
      // 5. Save
      // 6. Verify name changed in detail view
      // 7. Go back, verify name changed in list
    });
  });

  /**
   * MISSING FEATURE: Delete horse
   *
   * The API supports deleting horses via DELETE /api/horses/:id
   * (see TECHNICAL_SPECIFICATION.md section 5.1), but the controller
   * UI does not currently provide a way to delete horses.
   *
   * Neither HorseCard nor HorseDetail components have delete buttons.
   *
   * To implement this feature, the UI would need:
   * - A delete button (data-testid="delete-horse-btn")
   * - A confirmation modal (data-testid="delete-horse-modal")
   * - Confirm/cancel buttons for deletion
   */
  test.describe('Delete a horse', () => {
    test.skip('UI NOT IMPLEMENTED: should delete horse with confirmation', async () => {
      // This test is skipped because the delete UI doesn't exist.
      // The API supports DELETE /api/horses/:id but there's no UI for it.
      //
      // Expected flow when implemented:
      // 1. Seed 2 horses
      // 2. Click delete on one horse (data-testid="delete-horse-btn")
      // 3. Confirmation modal appears (data-testid="delete-horse-modal")
      // 4. Confirm deletion
      // 5. Verify only 1 horse remains in list
    });
  });
});
