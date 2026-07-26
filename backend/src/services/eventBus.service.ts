import { Server } from 'socket.io';
import { RealtimeEventType, RealtimeEventPayloads, RealtimeEvent } from '../types/realtime';
import { transactionStorage } from '../config/database';

class EventBusService {
  private io: Server | null = null;

  init(io: Server) {
    this.io = io;
    console.log('EventBusService initialized with Socket.io server');
  }

  publish<T extends RealtimeEventType>(type: T, payload: RealtimeEventPayloads[T]) {
    const event = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    } as Extract<RealtimeEvent, { type: T }>;

    const transactionContext = transactionStorage ? transactionStorage.getStore() : null;
    if (transactionContext) {
      console.log(`Queueing transaction-bound event: ${type}`);
      transactionContext.events.push(event);
    } else {
      this.emitEvent(event);
    }
  }

  emitEvent(event: RealtimeEvent) {
    console.log(`Emitting event: ${event.type}`, event.payload);
    if (this.io) {
      this.io.emit('realtime_event', event);
    }
  }
}

export const eventBus = new EventBusService();
