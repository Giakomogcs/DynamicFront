import { EventEmitter } from 'events';

/**
 * RealtimeService - Phase 5.2
 * 
 * WebSocket-based real-time updates for components:
 * - Subscribes components to data channels
 * - Broadcasts updates when data changes
 * - Handles connection lifecycle
 */
export class RealtimeService extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map(); // connectionId → WebSocket
        this.subscriptions = new Map(); // channel → Set<connectionId>
        this.componentChannels = new Map(); // componentId → channel
    }

    /**
     * Registers a WebSocket connection
     * @param {string} connectionId - Connection ID
     * @param {WebSocket} ws - WebSocket instance
     */
    registerConnection(connectionId, ws) {
        this.connections.set(connectionId, ws);
        console.log(`[RealtimeService] Connection registered: ${connectionId}`);

        // Setup message handler
        ws.on('message', (message) => {
            this.handleMessage(connectionId, message);
        });

        // Setup close handler
        ws.on('close', () => {
            this.unregisterConnection(connectionId);
        });
    }

    /**
     * Unregisters a connection
     * @param {string} connectionId - Connection ID
     */
    unregisterConnection(connectionId) {
        // Remove from all subscriptions
        this.subscriptions.forEach((subscribers, channel) => {
            subscribers.delete(connectionId);
        });

        this.connections.delete(connectionId);
        console.log(`[RealtimeService] Connection unregistered: ${connectionId}`);
    }

    /**
     * Handles incoming message from client
     * @private
     */
    handleMessage(connectionId, rawMessage) {
        try {
            const message = JSON.parse(rawMessage);

            switch (message.action) {
                case 'subscribe':
                    this.subscribe(connectionId, message.channel);
                    break;

                case 'unsubscribe':
                    this.unsubscribe(connectionId, message.channel);
                    break;

                case 'ping':
                    this.send(connectionId, { type: 'pong' });
                    break;

                default:
                    console.warn(`[RealtimeService] Unknown action: ${message.action}`);
            }
        } catch (error) {
            console.error('[RealtimeService] Error handling message:', error);
        }
    }

    /**
     * Subscribes a connection to a channel
     * @param {string} connectionId - Connection ID
     * @param {string} channel - Channel name
     */
    subscribe(connectionId, channel) {
        if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, new Set());
        }

        this.subscriptions.get(channel).add(connectionId);
        console.log(`[RealtimeService] ${connectionId} subscribed to ${channel}`);

        // Send confirmation
        this.send(connectionId, {
            type: 'subscribed',
            channel
        });
    }

    /**
     * Unsubscribes a connection from a channel
     * @param {string} connectionId - Connection ID
     * @param {string} channel - Channel name
     */
    unsubscribe(connectionId, channel) {
        const subscribers = this.subscriptions.get(channel);

        if (subscribers) {
            subscribers.delete(connectionId);
            console.log(`[RealtimeService] ${connectionId} unsubscribed from ${channel}`);

            // Clean up empty channels
            if (subscribers.size === 0) {
                this.subscriptions.delete(channel);
            }
        }
    }

    /**
     * Broadcasts data update to a channel
     * @param {string} channel - Channel name
     * @param {Object} data - Data to broadcast
     */
    broadcast(channel, data) {
        const subscribers = this.subscriptions.get(channel);

        if (!subscribers || subscribers.size === 0) {
            console.log(`[RealtimeService] No subscribers for channel: ${channel}`);
            return;
        }

        console.log(`[RealtimeService] Broadcasting to ${subscribers.size} subscribers on ${channel}`);

        const message = {
            type: 'update',
            channel,
            data,
            timestamp: Date.now()
        };

        subscribers.forEach(connectionId => {
            this.send(connectionId, message);
        });
    }

    /**
     * Sends message to specific connection
     * @param {string} connectionId - Connection ID
     * @param {Object} message - Message to send
     */
    send(connectionId, message) {
        const ws = this.connections.get(connectionId);

        if (ws && ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(message));
        }
    }

    /**
     * Registers a component's data channel
     * @param {string} componentId - Component ID
     * @param {string} channel - Channel name (e.g., 'courses-updates', 'schools-data')
     */
    registerComponentChannel(componentId, channel) {
        this.componentChannels.set(componentId, channel);
        console.log(`[RealtimeService] Component ${componentId} registered to channel ${channel}`);
    }

    /**
     * Triggers update for a component
     * @param {string} componentId - Component ID
     * @param {Object} data - Updated data
     */
    updateComponent(componentId, data) {
        const channel = this.componentChannels.get(componentId);

        if (channel) {
            this.broadcast(channel, data);
        } else {
            console.warn(`[RealtimeService] No channel registered for component: ${componentId}`);
        }
    }

    /**
     * Triggers update based on event
     * @param {string} event - Event name (e.g., 'course-created', 'school-updated')
     * @param {Object} data - Event data
     */
    triggerEvent(event, data) {
        console.log(`[RealtimeService] Event triggered: ${event}`);

        // Broadcast to event-specific channel
        this.broadcast(`event:${event}`, data);

        // Also broadcast to generic 'updates' channel
        this.broadcast('updates', { event, data });
    }

    /**
     * Gets service statistics
     * @returns {Object} - Stats
     */
    getStats() {
        const channelStats = Array.from(this.subscriptions.entries()).map(([channel, subscribers]) => ({
            channel,
            subscribers: subscribers.size
        }));

        return {
            activeConnections: this.connections.size,
            activeChannels: this.subscriptions.size,
            totalSubscriptions: Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0),
            channels: channelStats,
            registeredComponents: this.componentChannels.size
        };
    }
}

export const realtimeService = new RealtimeService();
