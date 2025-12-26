import { z } from 'zod';
import { setDisplay, setHorses, setFeeds, setDietEntries } from '../stores';
import {
  DisplaySchema,
  HorseSchema,
  FeedSchema,
  DietEntrySchema,
} from '@shared/resources';

/**
 * SSE Event Schemas for runtime validation
 */
const SSEStateEventSchema = z.object({
  type: z.literal('state'),
  data: z.object({
    display: DisplaySchema,
  }),
  timestamp: z.string().optional(),
});

const SSEDataEventSchema = z.object({
  type: z.literal('data'),
  data: z.object({
    horses: z.array(HorseSchema),
    feeds: z.array(FeedSchema),
    dietEntries: z.array(DietEntrySchema),
  }),
  timestamp: z.string().optional(),
});

const SSEFullEventSchema = z.object({
  type: z.literal('full'),
  data: z.object({
    display: DisplaySchema,
    horses: z.array(HorseSchema),
    feeds: z.array(FeedSchema),
    dietEntries: z.array(DietEntrySchema),
  }),
  timestamp: z.string().optional(),
});

const SSEEventSchema = z.discriminatedUnion('type', [
  SSEStateEventSchema,
  SSEDataEventSchema,
  SSEFullEventSchema,
]);

type SSEEvent = z.infer<typeof SSEEventSchema>;

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
          const parsed = JSON.parse(event.data);
          const result = SSEEventSchema.safeParse(parsed);
          if (!result.success) {
            console.error('Invalid SSE event format:', result.error.flatten());
            return;
          }
          this.handleEvent(result.data);
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
   * Handle incoming SSE event (validated by Zod schema)
   */
  private handleEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'state':
        setDisplay(event.data.display);
        break;
      case 'data':
        setHorses(event.data.horses);
        setFeeds(event.data.feeds);
        setDietEntries(event.data.dietEntries);
        break;
      case 'full':
        setDisplay(event.data.display);
        setHorses(event.data.horses);
        setFeeds(event.data.feeds);
        setDietEntries(event.data.dietEntries);
        break;
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
