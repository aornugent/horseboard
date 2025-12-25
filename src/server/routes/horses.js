import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { CreateHorseSchema, UpdateHorseSchema } from '../../shared/schemas/index.js';

export function createHorseRoutes(horseRepo, displayRepo) {
  const router = Router();

  // GET /api/displays/:displayId/horses - List horses for display
  router.get('/displays/:displayId/horses', (req, res) => {
    const display = displayRepo.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const horses = horseRepo.getByDisplayId(req.params.displayId);
    res.json({ success: true, data: horses });
  });

  // POST /api/displays/:displayId/horses - Create horse
  router.post('/displays/:displayId/horses', validate(CreateHorseSchema), (req, res) => {
    const display = displayRepo.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    try {
      const horse = horseRepo.create(
        req.params.displayId,
        req.body.name,
        req.body.note,
        req.body.noteExpiry
      );
      res.status(201).json({ success: true, data: horse });
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/horses/:id - Get horse by ID
  router.get('/horses/:id', (req, res) => {
    const horse = horseRepo.getById(req.params.id);
    if (!horse) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }
    res.json({ success: true, data: horse });
  });

  // PATCH /api/horses/:id - Update horse
  router.patch('/horses/:id', validate(UpdateHorseSchema), (req, res) => {
    const horse = horseRepo.getById(req.params.id);
    if (!horse) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }

    const updated = horseRepo.update(req.params.id, req.body);
    if (!updated) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }

    res.json({ success: true, data: updated });
  });

  // DELETE /api/horses/:id - Delete horse (cascades diet entries)
  router.delete('/horses/:id', (req, res) => {
    const deleted = horseRepo.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Horse not found' });
    }
    res.json({ success: true });
  });

  return router;
}
