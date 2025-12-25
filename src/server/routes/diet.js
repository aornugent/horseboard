import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { UpsertDietEntrySchema, BulkUpsertDietSchema } from '../../shared/schemas/index.js';

export function createDietRoutes(dietRepo, horseRepo, feedRepo) {
  const router = Router();

  // GET /api/horses/:horseId/diet - Get diet entries for horse
  router.get('/horses/:horseId/diet', (req, res) => {
    const horse = horseRepo.getById(req.params.horseId);
    if (!horse) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }

    const entries = dietRepo.getByHorseId(req.params.horseId);
    res.json({ success: true, data: entries });
  });

  // PUT /api/diet - Upsert single diet entry
  router.put('/diet', validate(UpsertDietEntrySchema), (req, res) => {
    const { horseId, feedId, amAmount, pmAmount } = req.body;

    // Validate horse exists
    const horse = horseRepo.getById(horseId);
    if (!horse) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }

    // Validate feed exists
    const feed = feedRepo.getById(feedId);
    if (!feed) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }

    // Validate feed belongs to same display as horse
    if (horse.displayId !== feed.displayId) {
      return res.status(400).json({
        success: false,
        error: 'Horse and feed must belong to the same display',
      });
    }

    const entry = dietRepo.upsert(horseId, feedId, amAmount ?? null, pmAmount ?? null);
    res.json({ success: true, data: entry });
  });

  // PUT /api/diet/bulk - Bulk upsert diet entries (atomic)
  router.put('/diet/bulk', validate(BulkUpsertDietSchema), (req, res) => {
    try {
      const count = dietRepo.bulkUpsert(req.body.entries);
      res.json({ success: true, data: { entriesUpdated: count } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DELETE /api/diet/:horseId/:feedId - Delete diet entry
  router.delete('/diet/:horseId/:feedId', (req, res) => {
    const deleted = dietRepo.delete(req.params.horseId, req.params.feedId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Diet entry not found' });
    }
    res.json({ success: true });
  });

  // POST /api/diet/cleanup - Clean up empty entries
  router.post('/diet/cleanup', (req, res) => {
    const count = dietRepo.cleanup();
    res.json({ success: true, data: { entriesRemoved: count } });
  });

  return router;
}
