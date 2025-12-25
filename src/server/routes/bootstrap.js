import { Router } from 'express';

/**
 * Bootstrap route for full UI hydration
 * Returns all relational data for a display in a single request
 */
export function createBootstrapRoutes(displayRepo, horseRepo, feedRepo, dietRepo) {
  const router = Router();

  // GET /api/bootstrap/:displayId - Full state for UI hydration
  router.get('/:displayId', (req, res) => {
    const display = displayRepo.getById(req.params.displayId);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Display not found' });
    }

    const horses = horseRepo.getByDisplayId(req.params.displayId);
    const feeds = feedRepo.getByDisplayId(req.params.displayId);
    const diet = dietRepo.getByDisplayId(req.params.displayId);

    res.json({
      success: true,
      data: {
        display,
        horses,
        feeds,
        diet,
      },
    });
  });

  // GET /api/pair/:code - Pair controller with display
  router.get('/pair/:code', (req, res) => {
    const display = displayRepo.getByPairCode(req.params.code);
    if (!display) {
      return res.status(404).json({ success: false, error: 'Invalid pairing code' });
    }

    const horses = horseRepo.getByDisplayId(display.id);
    const feeds = feedRepo.getByDisplayId(display.id);
    const diet = dietRepo.getByDisplayId(display.id);

    res.json({
      success: true,
      data: {
        display,
        horses,
        feeds,
        diet,
      },
    });
  });

  return router;
}
