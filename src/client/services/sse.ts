import { z } from 'zod';
import { batch } from '@preact/signals';
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

// Granular update events for individual resources
const SSEHorsesEventSchema = z.object({
  type: z.literal('horses'),
  data: z.array(HorseSchema).optional(),
  timestamp: z.string().optional(),
});

const SSEFeedsEventSchema = z.object({
  type: z.literal('feeds'),
  data: z.array(FeedSchema).optional(),
  timestamp: z.string().optional(),
});

const SSEDietEventSchema = z.object({
  type: z.literal('diet'),
  data: z.array(DietEntrySchema).optional(),
  timestamp: z.string().optional(),
});

const SSEEventSchema = z.discriminatedUnion('type', [
  SSEStateEventSchema,
  SSEDataEventSchema,
  SSEFullEventSchema,
  SSEHorsesEventSchema,
  SSEFeedsEventSchema,
  SSEDietEventSchema,
]);

type SSEEvent = z.infer<typeof SSEEventSchema>;

/**
 * SSE Client for real-time updates
 *
 * All store updates from SSE use source='sse' to ensure they
 * take precedence over potentially stale API responses.
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
    return new Promise((resolve, _reject) => {
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
   *
   * Uses batch() to group multiple store updates into a single
   * reactive update cycle, and passes 'sse' as the source to
   * ensure server data takes precedence over local state.
   */
  private handleEvent(event: SSEEvent): void {
    // Use batch to minimize re-renders when updating multiple stores
    batch(() => {
      switch (event.type) {
        case 'state':
          // Display state update only
          setDisplay(event.data.display, 'sse');
          break;

        case 'data':
          // Full data update (horses, feeds, diet)
          setHorses(event.data.horses, 'sse');
          setFeeds(event.data.feeds, 'sse');
          setDietEntries(event.data.dietEntries, 'sse');
          break;

        case 'full':
          // Complete state + data update
          setDisplay(event.data.display, 'sse');
          setHorses(event.data.horses, 'sse');
          setFeeds(event.data.feeds, 'sse');
          setDietEntries(event.data.dietEntries, 'sse');
          break;

        case 'horses':
          // Granular horses update - refetch if no data provided
          if (event.data) {
            setHorses(event.data, 'sse');
          } else {
            this.refetchResource('horses');
          }
          break;

        case 'feeds':
          // Granular feeds update - refetch if no data provided
          if (event.data) {
            setFeeds(event.data, 'sse');
          } else {
            this.refetchResource('feeds');
          }
          break;

        case 'diet':
          // Granular diet update - refetch if no data provided
          if (event.data) {
            setDietEntries(event.data, 'sse');
          } else {
            this.refetchResource('diet');
          }
          break;
      }
    });
  }

  /**
   * Refetch a specific resource when SSE event doesn't include data
   */
  private async refetchResource(resource: 'horses' | 'feeds' | 'diet'): Promise<void> {
    if (!this.displayId) return;

    try {
      let url: string;
      if (resource === 'diet') {
        url = `/api/diet?displayId=${this.displayId}`;
      } else {
        url = `/api/displays/${this.displayId}/${resource}`;
      }

      const response = await fetch(url);
      if (!response.ok) return;

      const { data } = await response.json();

      // Use 'sse' source since this was triggered by SSE
      batch(() => {
        switch (resource) {
          case 'horses':
            setHorses(data, 'sse');
            break;
          case 'feeds':
            setFeeds(data, 'sse');
            break;
          case 'diet':
            setDietEntries(data, 'sse');
            break;
        }
      });
    } catch (err) {
      console.error(`Failed to refetch ${resource}:`, err);
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
