/**
 * Server-Sent Events manager for real-time updates
 */
export class SSEManager {
  constructor() {
    // Map of displayId -> Set of response objects
    this.clients = new Map();
  }

  /**
   * Add a client connection for a display
   */
  addClient(displayId, res) {
    if (!this.clients.has(displayId)) {
      this.clients.set(displayId, new Set());
    }
    this.clients.get(displayId).add(res);

    // Remove client on disconnect
    res.on('close', () => {
      this.removeClient(displayId, res);
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(displayId, res) {
    const clients = this.clients.get(displayId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        this.clients.delete(displayId);
      }
    }
  }

  /**
   * Broadcast update to all clients watching a display
   */
  broadcast(displayId, data) {
    const clients = this.clients.get(displayId);
    if (!clients || clients.size === 0) {
      return 0;
    }

    const message = `data: ${JSON.stringify(data)}\n\n`;
    let sent = 0;

    for (const client of clients) {
      try {
        client.write(message);
        sent++;
      } catch (err) {
        // Client disconnected, remove it
        this.removeClient(displayId, client);
      }
    }

    return sent;
  }

  /**
   * Get count of connected clients for a display
   */
  getClientCount(displayId) {
    const clients = this.clients.get(displayId);
    return clients ? clients.size : 0;
  }

  /**
   * Get total connected clients across all displays
   */
  getTotalClientCount() {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.size;
    }
    return total;
  }
}

export default SSEManager;
