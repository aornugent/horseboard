import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { UpdateDisplaySchema, SetTimeModeSchema } from '../../shared/schemas/index.js';

export function createDisplayRoutes(displayRepo) {
  const router = Router();

  // GET /api/displays/:id - Get display by ID
  router.get('/:id', (req, res) => {
    const display = displayRepo.getById(req.params.id);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }
    res.json({ success: true, data: display });
  });

  // POST /api/displays - Create new display
  router.post('/', (req, res) => {
    try {
      const { timezone } = req.body;
      const display = displayRepo.create(timezone);
      res.status(201).json({ success: true, data: display });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // PATCH /api/displays/:id - Update display settings
  router.patch('/:id', validate(UpdateDisplaySchema), (req, res) => {
    const display = displayRepo.getById(req.params.id);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const updated = displayRepo.update(req.params.id, req.body);
    if (!updated) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }

    res.json({ success: true, data: displayRepo.getById(req.params.id) });
  });

  // PUT /api/displays/:id/time-mode - Set time mode
  router.put('/:id/time-mode', validate(SetTimeModeSchema), (req, res) => {
    const display = displayRepo.getById(req.params.id);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const { timeMode, overrideUntil } = req.body;
    const updated = displayRepo.setTimeMode(req.params.id, timeMode, overrideUntil);
    if (!updated) {
      return res.status(500).json({ success: false, error: 'Update failed' });
    }

    res.json({ success: true, data: displayRepo.getById(req.params.id) });
  });

  // DELETE /api/displays/:id - Delete display
  router.delete('/:id', (req, res) => {
    const deleted = displayRepo.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }
    res.json({ success: true });
  });

  return router;
}
