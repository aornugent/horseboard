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
 * - Edit horse name
 * - Delete a horse
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

  test.describe('Edit horse name', () => {
    test('should edit horse name via modal', async ({ page, request }) => {
      // Seed 1 horse
      testData = await seedTestData(page, request, {
        horseCount: 1,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      const horse = testData.horses[0];
      const originalName = horse.name;
      const newName = 'Updated Horse Name';

      // Click on horse card to go to detail
      await page.locator(selectors.horseCard(horse.id)).click();
      await expect(page.locator(selectors.horseDetail)).toBeVisible();

      // Click edit button
      await page.locator(selectors.editHorseBtn).click();

      // Modal should appear with current name
      await expect(page.locator(selectors.editHorseModal)).toBeVisible();
      await expect(page.locator(selectors.editHorseName)).toHaveValue(originalName);

      // Clear and enter new name
      await page.locator(selectors.editHorseName).fill(newName);

      // Save changes
      await page.locator(selectors.confirmEditHorse).click();

      // Modal should close
      await expect(page.locator(selectors.editHorseModal)).not.toBeVisible();

      // Verify name changed in detail view
      await expect(page.locator(selectors.horseDetailName)).toHaveText(newName);

      // Go back to list
      await page.locator(selectors.horseDetailBack).click();

      // Verify name changed in list
      await expect(page.locator(selectors.horseCardName(horse.id))).toHaveText(newName);
    });

    test('should cancel editing horse name', async ({ page, request }) => {
      testData = await seedTestData(page, request, {
        horseCount: 1,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      const horse = testData.horses[0];
      const originalName = horse.name;

      // Go to detail and open edit modal
      await page.locator(selectors.horseCard(horse.id)).click();
      await page.locator(selectors.editHorseBtn).click();
      await expect(page.locator(selectors.editHorseModal)).toBeVisible();

      // Change name but cancel
      await page.locator(selectors.editHorseName).fill('Changed Name');
      await page.locator(selectors.cancelEditHorse).click();

      // Modal should close
      await expect(page.locator(selectors.editHorseModal)).not.toBeVisible();

      // Name should remain unchanged
      await expect(page.locator(selectors.horseDetailName)).toHaveText(originalName);
    });
  });

  test.describe('Delete a horse', () => {
    test('should delete horse with confirmation', async ({ page, request }) => {
      // Seed 2 horses
      testData = await seedTestData(page, request, {
        horseCount: 2,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      const horse1 = testData.horses[0];
      const horse2 = testData.horses[1];

      // Verify both horses are visible
      await expect(page.locator(selectors.horseCard(horse1.id))).toBeVisible();
      await expect(page.locator(selectors.horseCard(horse2.id))).toBeVisible();

      // Click on first horse to go to detail
      await page.locator(selectors.horseCard(horse1.id)).click();
      await expect(page.locator(selectors.horseDetail)).toBeVisible();

      // Click delete button
      await page.locator(selectors.deleteHorseBtn).click();

      // Confirmation modal should appear
      await expect(page.locator(selectors.deleteHorseModal)).toBeVisible();

      // Confirm deletion
      await page.locator(selectors.confirmDeleteHorse).click();

      // Should be redirected back to list
      await expect(page.locator(selectors.horseList)).toBeVisible();

      // Only second horse should remain
      await expect(page.locator(selectors.horseCard(horse1.id))).not.toBeVisible();
      await expect(page.locator(selectors.horseCard(horse2.id))).toBeVisible();
    });

    test('should cancel deleting a horse', async ({ page, request }) => {
      testData = await seedTestData(page, request, {
        horseCount: 1,
        feedCount: 0,
        createDietEntries: false,
      });

      await navigateWithBoard(page, '/controller', testData.board.id);
      await waitForControllerReady(page);

      const horse = testData.horses[0];

      // Go to detail and open delete modal
      await page.locator(selectors.horseCard(horse.id)).click();
      await page.locator(selectors.deleteHorseBtn).click();
      await expect(page.locator(selectors.deleteHorseModal)).toBeVisible();

      // Cancel deletion
      await page.locator(selectors.cancelDeleteHorse).click();

      // Modal should close
      await expect(page.locator(selectors.deleteHorseModal)).not.toBeVisible();

      // Should still be on detail view
      await expect(page.locator(selectors.horseDetail)).toBeVisible();
      await expect(page.locator(selectors.horseDetailName)).toHaveText(horse.name);

      // Go back and verify horse still exists
      await page.locator(selectors.horseDetailBack).click();
      await expect(page.locator(selectors.horseCard(horse.id))).toBeVisible();
    });
  });
});
