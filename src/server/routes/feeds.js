import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { CreateFeedSchema, UpdateFeedSchema } from '../../shared/schemas/index.js';

export function createFeedRoutes(feedRepo, displayRepo) {
  const router = Router();

  // GET /api/displays/:displayId/feeds - List feeds for display
  router.get('/displays/:displayId/feeds', (req, res) => {
    const display = displayRepo.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const feeds = feedRepo.getByDisplayId(req.params.displayId);
    res.json({ success: true, data: feeds });
  });

  // POST /api/displays/:displayId/feeds - Create feed
  router.post('/displays/:displayId/feeds', validate(CreateFeedSchema), (req, res) => {
    const display = displayRepo.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    try {
      const feed = feedRepo.create(req.params.displayId, req.body.name, req.body.unit);
      res.status(201).json({ success: true, data: feed });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/feeds/:id - Get feed by ID
  router.get('/feeds/:id', (req, res) => {
    const feed = feedRepo.getById(req.params.id);
    if (!feed) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }
    res.json({ success: true, data: feed });
  });

  // PATCH /api/feeds/:id - Update feed
  router.patch('/feeds/:id', validate(UpdateFeedSchema), (req, res) => {
    const feed = feedRepo.getById(req.params.id);
    if (!feed) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }

    const updated = feedRepo.update(req.params.id, req.body);
    if (!updated) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }

    res.json({ success: true, data: updated });
  });

  // DELETE /api/feeds/:id - Delete feed (cascades diet entries)
  router.delete('/feeds/:id', (req, res) => {
    const deleted = feedRepo.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Feed not found' });
    }
    res.json({ success: true });
  });

  // POST /api/displays/:displayId/feeds/recalculate-rankings - Recalculate feed rankings
  router.post('/displays/:displayId/feeds/recalculate-rankings', (req, res) => {
    const display = displayRepo.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const count = feedRepo.recalculateRankings(req.params.displayId);
    res.json({ success: true, data: { feedsRanked: count } });
  });

  return router;
}
