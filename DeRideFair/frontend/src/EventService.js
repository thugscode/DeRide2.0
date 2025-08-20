class EventService {
  constructor() {
    this.websocket = null;
    this.isConnected = false;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000; // 1 seconds
    this.baseUrl = process.env.REACT_APP_BACKEND_URL || 'ws://localhost:2000';
    this.heartbeatInterval = null;
    this.connectionState = {
      status: 'disconnected',
      health: false,
      lastUpdate: new Date().toISOString(),
      reconnectAttempts: 0,
      messages: []
    };
  }

  // Initialize the service
  init() {
    console.log('🔧 Initializing EventService...');
    this.isConnected = false;
    this.setConnectionStatus(false);
    console.log('✅ EventService initialized');
  }

  connect(tokenParam = null) {
    return new Promise((resolve, reject) => {
      try {
        const token = tokenParam || sessionStorage.getItem('token');
        if (!token) {
          console.error('❌ No authentication token found');
          this.setConnectionStatus(false);
          reject(new Error('No authentication token found'));
          return;
        }

        // Close existing connection if any
        this.disconnect();

        console.log('🔌 Connecting to WebSocket...');
        
        // Create WebSocket connection
        const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
        this.websocket = new WebSocket(`${wsUrl}/ws`);

        this.websocket.onopen = () => {
          console.log('✅ WebSocket connection established');
          
          // Authenticate with token
          this.websocket.send(JSON.stringify({
            type: 'authenticate',
            token: token,
            connectionId: Date.now().toString(),
            timestamp: new Date().toISOString()
          }));
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', data);
            this.notifyListeners('message', data);
            
            // Handle specific event types
            if (data.type === 'CONNECTED' || data.message === 'Real-time notifications connected') {
              console.log('🎉 WebSocket connected and authenticated successfully!');
              this.isConnected = true;
              this.reconnectAttempts = 0;
              this.setConnectionStatus(true);
              this.notifyListeners('connection', { status: 'connected' });
              this.startHeartbeat();
              resolve();
            } else if (data.type === 'HEARTBEAT') {
              // Send pong response
              if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify({ 
                  type: 'pong',
                  timestamp: new Date().toISOString(),
                  connectionId: Date.now().toString()
                }));
              }
            } else if (data.type === 'error') {
              console.error('❌ WebSocket error from server:', data.message);
              this.setConnectionStatus(false);
              this.notifyListeners('error', data);
              reject(new Error(data.message));
            }
            
            // Notify type-specific listeners
            if (data.type) {
              this.notifyListeners(data.type, data);
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket connection error:', error);
          this.isConnected = false;
          this.setConnectionStatus(false);
          this.stopHeartbeat();
          this.notifyListeners('connection', { status: 'error', error });
          
          // Attempt to reconnect
          this.handleReconnect();
          reject(error);
        };

        this.websocket.onclose = (event) => {
          console.log('🔌 WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.setConnectionStatus(false);
          this.stopHeartbeat();
          this.notifyListeners('connection', { status: 'closed' });
          
          // Attempt to reconnect if not a clean close
          if (event.code !== 1000) {
            this.handleReconnect();
          }
        };

      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        this.setConnectionStatus(false);
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.websocket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.stopHeartbeat();
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    this.isConnected = false;
    this.setConnectionStatus(false);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    // Client doesn't need to send heartbeat, just respond to server's
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.notifyListeners('connection', { status: 'failed', message: 'Max reconnection attempts reached' });
    }
  }

  setConnectionStatus(connected) {
    console.log(`🔄 Setting connection status: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
    this.isConnected = connected;
    const state = this.getConnectionState();
    const health = this.getConnectionHealth();
    
    console.log(`📊 Connection details: State=${state}, Health=${health.healthy}`);
    
    // Update internal connection state
    this.connectionState = {
      status: connected ? 'connected' : 'disconnected',
      health: health.healthy,
      lastUpdate: new Date().toISOString(),
      reconnectAttempts: this.reconnectAttempts,
      messages: []
    };
    
    // Notify all connection status listeners
    this.notifyListeners('connectionState', { 
      connected,
      state,
      health: health.healthy,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      message: connected ? 'Real-time notifications connected' : 'Disconnected from server'
    });
  }

  // Event listener management
  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  // Alias for addEventListener (for compatibility)
  on(eventType, callback) {
    this.addEventListener(eventType, callback);
  }

  removeEventListener(eventType, callback) {
    if (this.listeners.has(eventType)) {
      const callbacks = this.listeners.get(eventType);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  // Send message to server
  send(data) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(data));
    } else {
      console.error('❌ WebSocket is not connected, cannot send message');
    }
  }

  // Check if connected
  getConnectionStatus() {
    return this.isConnected;
  }

  // Get connection health information
  getConnectionHealth() {
    const isHealthy = this.isConnected && 
                     this.websocket && 
                     this.websocket.readyState === WebSocket.OPEN;
    
    return {
      healthy: isHealthy,
      connected: this.isConnected,
      websocketState: this.websocket ? this.websocket.readyState : -1,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      timeSinceLastActivity: this.isConnected ? 0 : null
    };
  }

  // Get connection state for display
  getConnectionState() {
    if (!this.websocket) return 'DISCONNECTED';
    
    switch (this.websocket.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return this.isConnected ? 'CONNECTED' : 'AUTHENTICATING';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Create singleton instance
const eventService = new EventService();
eventService.init();

export default eventService;
