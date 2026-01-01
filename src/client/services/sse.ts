import { z } from 'zod';
import { batch } from '@preact/signals';
import { setBoard, setHorses, setFeeds, setDietEntries } from '../stores';
import {
  BoardSchema,
  HorseSchema,
  FeedSchema,
  DietEntrySchema,
} from '@shared/resources';

/**
 * SSE Event Schemas for runtime validation
 */
const SSEEventSchema = z.object({
  data: z.object({
    board: BoardSchema,
    horses: z.array(HorseSchema),
    feeds: z.array(FeedSchema),
    diet_entries: z.array(DietEntrySchema),
  }),
  timestamp: z.string().optional(),
});

type SSEEvent = z.infer<typeof SSEEventSchema>;

/**
 * SSE Client for real-time updates
 *
 * All store updates from SSE use source='sse' to ensure they
 * take precedence over potentially stale API responses.
 */
class SSEClient {
  private eventSource: EventSource | null = null;
  private boardId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private onConnectedCallback?: () => void;
  private onDisconnectedCallback?: () => void;
  private onErrorCallback?: (error: Event) => void;

  /**
   * Connect to SSE endpoint for a board
   */
  connect(boardId: string): Promise<void> {
    return new Promise((resolve, _reject) => {
      if (this.eventSource) {
        this.disconnect();
      }

      this.boardId = boardId;
      this.eventSource = new EventSource(`/api/boards/${boardId}/events`);

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
    this.boardId = null;
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
      setBoard(event.data.board, 'sse');
      setHorses(event.data.horses, 'sse');
      setFeeds(event.data.feeds, 'sse');
      setDietEntries(event.data.diet_entries, 'sse');
    });
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
      if (this.boardId) {
        this.connect(this.boardId).catch(console.error);
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
   * Get current board ID
   */
  getBoardId(): string | null {
    return this.boardId;
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
