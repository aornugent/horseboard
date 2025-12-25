import { setDisplay, display } from '../stores/display';
import { setHorses } from '../stores/horses';
import { setFeeds } from '../stores/feeds';
import { setDietEntries } from '../stores/diet';
import type { Display, Horse, Feed, DietEntry } from '@shared/types';

/**
 * SSE Event Types
 */
interface SSEStateEvent {
  type: 'state';
  display: Display;
}

interface SSEDataEvent {
  type: 'data';
  horses: Horse[];
  feeds: Feed[];
  dietEntries: DietEntry[];
}

interface SSEFullEvent {
  type: 'full';
  display: Display;
  horses: Horse[];
  feeds: Feed[];
  dietEntries: DietEntry[];
}

// Legacy event format (for backwards compatibility with existing server)
interface SSELegacyEvent {
  tableData?: unknown;
  updatedAt?: string;
}

type SSEEvent = SSEStateEvent | SSEDataEvent | SSEFullEvent | SSELegacyEvent;

/**
 * SSE Client for real-time updates
 */
class SSEClient {
  private eventSource: EventSource | null = null;
  private displayId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private onConnectedCallback?: () => void;
  private onDisconnectedCallback?: () => void;
  private onErrorCallback?: (error: Event) => void;

  /**
   * Connect to SSE endpoint for a display
   */
  connect(displayId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.eventSource) {
        this.disconnect();
      }

      this.displayId = displayId;
      this.eventSource = new EventSource(`/api/displays/${displayId}/events`);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.onConnectedCallback?.();
        resolve();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SSEEvent;
          this.handleEvent(data);
        } catch (err) {
          console.error('Failed to parse SSE event:', err);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.onErrorCallback?.(error);

        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.onDisconnectedCallback?.();
          this.attemptReconnect();
        }
      };
    });
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.displayId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Handle incoming SSE event
   */
  private handleEvent(data: SSEEvent): void {
    // Handle typed events
    if ('type' in data) {
      switch (data.type) {
        case 'state':
          setDisplay(data.display);
          break;
        case 'data':
          setHorses(data.horses);
          setFeeds(data.feeds);
          setDietEntries(data.dietEntries);
          break;
        case 'full':
          setDisplay(data.display);
          setHorses(data.horses);
          setFeeds(data.feeds);
          setDietEntries(data.dietEntries);
          break;
      }
    }

    // Handle legacy events (backwards compatibility)
    // The current server sends { tableData, updatedAt } format
    if ('tableData' in data || 'updatedAt' in data) {
      // Legacy format - just update the timestamp in display if we have one
      if (display.value && data.updatedAt) {
        setDisplay({ ...display.value, updatedAt: data.updatedAt });
      }
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.displayId) {
        this.connect(this.displayId).catch(console.error);
      }
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get current display ID
   */
  getDisplayId(): string | null {
    return this.displayId;
  }

  /**
   * Set callback handlers
   */
  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  onError(callback: (error: Event) => void): void {
    this.onErrorCallback = callback;
  }
}

// Singleton instance
export const sseClient = new SSEClient();

export default sseClient;
