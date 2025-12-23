import { Router } from 'express';

/**
 * Create API routes
 */
export function createRoutes(displayService, sseManager, timeModeService) {
  const router = Router();

  /**
   * POST /api/displays - Create a new display
   */
  router.post('/displays', (req, res) => {
    try {
      const display = displayService.createDisplay();
      res.status(201).json(display);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create display' });
    }
  });

  /**
   * GET /api/displays/:id - Get display data
   */
  router.get('/displays/:id', (req, res) => {
    const display = displayService.getDisplay(req.params.id);
    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }
    res.json(display);
  });

  /**
   * PUT /api/displays/:id - Update display data
   */
  router.put('/displays/:id', (req, res) => {
    const { tableData } = req.body;

    if (tableData === undefined) {
      return res.status(400).json({ error: 'tableData is required' });
    }

    const result = displayService.updateDisplay(req.params.id, tableData);

    if (!result.success) {
      const status = result.error === 'Display not found' ? 404 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }

    // Broadcast update to SSE clients
    const display = displayService.getDisplay(req.params.id);
    if (display) {
      sseManager.broadcast(req.params.id, {
        tableData: display.tableData,
        updatedAt: result.updatedAt
      });
    }

    res.json(result);
  });

  /**
   * DELETE /api/displays/:id - Delete a display
   */
  router.delete('/displays/:id', (req, res) => {
    const deleted = displayService.deleteDisplay(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Display not found' });
    }
    res.json({ success: true });
  });

  /**
   * POST /api/pair - Pair controller with display
   */
  router.post('/pair', (req, res) => {
    const { code } = req.body;

    // Validate code format
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Code must be 6 digits' });
    }

    const result = displayService.pairWithCode(code);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  });

  /**
   * GET /api/displays/:id/events - SSE endpoint for real-time updates
   */
  router.get('/displays/:id/events', (req, res) => {
    const display = displayService.getDisplay(req.params.id);
    if (!display) {
      return res.status(404).json({ error: 'Display not found' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial data
    res.write(`data: ${JSON.stringify({
      tableData: display.tableData,
      updatedAt: display.updatedAt
    })}\n\n`);

    // Register client for updates
    sseManager.addClient(req.params.id, res);

    // Keep connection alive with periodic comments
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    // Cleanup on disconnect
    res.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  /**
   * GET /api/displays/:id/time-mode - Get current time mode
   */
  router.get('/displays/:id/time-mode', (req, res) => {
    if (!timeModeService) {
      return res.status(500).json({ error: 'Time mode service not available' });
    }

    const result = timeModeService.getCurrentMode(req.params.id);

    if (!result.success) {
      const status = result.error === 'Display not found' ? 404 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }

    res.json(result);
  });

  /**
   * PUT /api/displays/:id/time-mode - Set time mode override
   */
  router.put('/displays/:id/time-mode', (req, res) => {
    if (!timeModeService) {
      return res.status(500).json({ error: 'Time mode service not available' });
    }

    const { mode } = req.body;

    if (!mode) {
      return res.status(400).json({ success: false, error: 'mode is required' });
    }

    if (mode === 'AUTO') {
      const result = timeModeService.clearOverride(req.params.id);
      if (!result.success) {
        const status = result.error === 'Display not found' ? 404 : 400;
        return res.status(status).json(result);
      }
      return res.json(result);
    }

    const result = timeModeService.setOverride(req.params.id, mode);

    if (!result.success) {
      const status = result.error === 'Display not found' ? 404 : 400;
      return res.status(status).json(result);
    }

    res.json(result);
  });

  return router;
}

export default createRoutes;
