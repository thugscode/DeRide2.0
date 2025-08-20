import React, { Component } from 'react';
import { 
  Chip, 
  Tooltip, 
  Typography, 
  Box,
  LinearProgress,
  IconButton,
  Collapse
} from '@mui/material';
import { 
  Wifi, 
  WifiOff, 
  CloudOff, 
  Sync, 
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess,
  InfoOutlined
} from '@mui/icons-material';
import eventService from '../EventService';

class ConnectionStatus extends Component {
  constructor(props) {
    super(props);
    this.state = {
      connectionState: 'DISCONNECTED',
      message: '',
      connected: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      expanded: false,
      lastUpdate: null,
      connectionHealth: { healthy: false, timeSinceLastActivity: null }
    };
  }

  componentDidMount() {
    // Listen for connection state changes
    eventService.on('connectionState', this.handleConnectionStateChange);
    
    // Update initial state
    this.updateConnectionStatus();
    
    // Start health check interval
    this.healthCheckInterval = setInterval(() => {
      this.updateConnectionHealth();
    }, 5000); // Check every 5 seconds
  }

  componentWillUnmount() {
    eventService.removeEventListener('connectionState', this.handleConnectionStateChange);
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  handleConnectionStateChange = (data) => {
    this.setState({
      connectionState: data.state,
      message: data.message,
      connected: data.connected,
      reconnectAttempts: data.reconnectAttempts || 0,
      maxReconnectAttempts: data.maxReconnectAttempts || 5,
      lastUpdate: new Date(),
      connectionHealth: { 
        healthy: data.health !== undefined ? data.health : data.connected,
        timeSinceLastActivity: data.connected ? 0 : null 
      }
    });
  }

  updateConnectionStatus() {
    const connected = eventService.getConnectionStatus();
    const state = eventService.getConnectionState();
    const health = eventService.getConnectionHealth();
    
    this.setState({
      connectionState: state,
      connected: connected,
      reconnectAttempts: health.reconnectAttempts || 0,
      maxReconnectAttempts: health.maxReconnectAttempts || 5,
      lastUpdate: new Date(),
      connectionHealth: {
        healthy: health.healthy,
        timeSinceLastActivity: health.timeSinceLastActivity
      }
    });
  }

  updateConnectionHealth() {
    const health = eventService.getConnectionHealth();
    this.setState({ connectionHealth: health });
  }

  getStatusConfig() {
    const { connectionState, connected, reconnectAttempts, maxReconnectAttempts } = this.state;
    
    switch (connectionState) {
      case 'CONNECTED':
        return {
          icon: <Wifi />,
          label: 'Connected',
          color: 'primary',
          bgColor: '#e8f5e8',
          textColor: '#4CAF50',
          severity: 'success'
        };
      case 'CONNECTING':
        return {
          icon: <Sync className="rotating" />,
          label: 'Connecting...',
          color: 'default',
          bgColor: '#fff3e0',
          textColor: '#FF9800',
          severity: 'info'
        };
      case 'RECONNECTING':
        return {
          icon: <Sync className="rotating" />,
          label: `Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})`,
          color: 'default',
          bgColor: '#fff3e0',
          textColor: '#FF9800',
          severity: 'warning'
        };
      case 'ERROR':
        return {
          icon: <ErrorIcon />,
          label: 'Connection Error',
          color: 'secondary',
          bgColor: '#ffebee',
          textColor: '#f44336',
          severity: 'error'
        };
      case 'DISCONNECTED':
      default:
        return {
          icon: <WifiOff />,
          label: 'Disconnected',
          color: 'default',
          bgColor: '#f5f5f5',
          textColor: '#757575',
          severity: 'warning'
        };
    }
  }

  formatTimeSince(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  }

  render() {
    const { 
      compact = false, 
      showDetails = true, 
      style = {} 
    } = this.props;
    
    const { 
      connectionState, 
      message, 
      expanded, 
      lastUpdate,
      connectionHealth 
    } = this.state;
    
    const config = this.getStatusConfig();

    if (compact) {
      return (
        <Tooltip title={`Connection: ${config.label}${message ? ` - ${message}` : ''}`}>
          <Chip
            icon={config.icon}
            label={config.label}
            color={config.color}
            size="small"
            style={{
              backgroundColor: config.bgColor,
              color: config.textColor,
              fontWeight: 'bold',
              ...style
            }}
          />
        </Tooltip>
      );
    }

    return (
      <Box style={{ ...style }}>
        <Box 
          display="flex" 
          alignItems="center" 
          style={{
            backgroundColor: config.bgColor,
            padding: '8px 12px',
            borderRadius: '8px',
            border: `1px solid ${config.textColor}33`,
            cursor: showDetails ? 'pointer' : 'default'
          }}
          onClick={showDetails ? () => this.setState({ expanded: !expanded }) : undefined}
        >
          <Box display="flex" alignItems="center" flexGrow={1}>
            {React.cloneElement(config.icon, { 
              style: { 
                color: config.textColor, 
                marginRight: '8px',
                fontSize: '18px'
              } 
            })}
            <Typography 
              variant="caption" 
              style={{ 
                color: config.textColor, 
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              {config.label}
            </Typography>
          </Box>
          
          {showDetails && (
            <IconButton 
              size="small" 
              style={{ color: config.textColor, padding: '2px' }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>

        {/* Connection Progress for reconnecting state */}
        {connectionState === 'RECONNECTING' && (
          <LinearProgress 
            color="primary" 
            style={{ 
              marginTop: '4px', 
              height: '2px',
              borderRadius: '1px'
            }} 
          />
        )}

        {showDetails && (
          <Collapse in={expanded}>
            <Box 
              style={{
                backgroundColor: 'rgba(0,0,0,0.02)',
                padding: '8px',
                marginTop: '4px',
                borderRadius: '4px',
                border: '1px solid rgba(0,0,0,0.1)'
              }}
            >
              <Typography variant="caption" display="block" style={{ fontSize: '10px', color: '#666' }}>
                <strong>State:</strong> {connectionState}
              </Typography>
              
              {message && (
                <Typography variant="caption" display="block" style={{ fontSize: '10px', color: '#666' }}>
                  <strong>Message:</strong> {message}
                </Typography>
              )}
              
              {lastUpdate && (
                <Typography variant="caption" display="block" style={{ fontSize: '10px', color: '#666' }}>
                  <strong>Last Update:</strong> {lastUpdate.toLocaleTimeString()}
                </Typography>
              )}
              
              {connectionHealth.timeSinceLastActivity !== null && (
                <Typography variant="caption" display="block" style={{ fontSize: '10px', color: '#666' }}>
                  <strong>Last Activity:</strong> {this.formatTimeSince(Date.now() - connectionHealth.timeSinceLastActivity)}
                </Typography>
              )}
              
              <Box display="flex" alignItems="center" marginTop="4px">
                <Typography variant="caption" style={{ fontSize: '10px', color: '#666' }}>
                  <strong>Health:</strong>
                </Typography>
                <Chip
                  size="small"
                  label={connectionHealth.healthy ? 'Healthy' : 'Unhealthy'}
                  style={{
                    marginLeft: '4px',
                    height: '16px',
                    fontSize: '9px',
                    backgroundColor: connectionHealth.healthy ? '#e8f5e8' : '#ffebee',
                    color: connectionHealth.healthy ? '#4CAF50' : '#f44336'
                  }}
                />
              </Box>
            </Box>
          </Collapse>
        )}

        <style jsx>{`
          .rotating {
            animation: rotation 1s infinite linear;
          }
          
          @keyframes rotation {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(359deg);
            }
          }
        `}</style>
      </Box>
    );
  }
}

export default ConnectionStatus;
