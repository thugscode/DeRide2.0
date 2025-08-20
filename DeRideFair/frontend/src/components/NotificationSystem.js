import React, { Component } from 'react';
import { 
  Snackbar, 
  IconButton,
  Slide,
  Grow
} from '@material-ui/core';
import { 
  Alert,
  AlertTitle
} from '@material-ui/lab';
import { 
  Close,
  Wifi,
  Assignment,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info
} from '@material-ui/icons';

function SlideTransition(props) {
  return <Slide {...props} direction="down" />;
}

function GrowTransition(props) {
  return <Grow {...props} />;
}

class NotificationSystem extends Component {
  constructor(props) {
    super(props);
    this.state = {
      notifications: []
    };
    this.notificationId = 0;
    this.connectionNotificationShown = false;
  }

  componentDidMount() {
    // Listen for notification events
    if (this.props.eventService) {
      this.props.eventService.on('connection', this.handleConnectionNotification);
      this.props.eventService.on('ASSIGNMENT_STARTING', this.handleAssignmentStarting);
      this.props.eventService.on('ASSIGNMENT_COMPLETED', this.handleAssignmentCompleted);
      this.props.eventService.on('ASSIGNMENT_FAILED', this.handleAssignmentFailed);
      this.props.eventService.on('error', this.handleError);
    }
  }

  componentWillUnmount() {
    if (this.props.eventService) {
      this.props.eventService.removeEventListener('connection', this.handleConnectionNotification);
      this.props.eventService.removeEventListener('ASSIGNMENT_STARTING', this.handleAssignmentStarting);
      this.props.eventService.removeEventListener('ASSIGNMENT_COMPLETED', this.handleAssignmentCompleted);
      this.props.eventService.removeEventListener('ASSIGNMENT_FAILED', this.handleAssignmentFailed);
      this.props.eventService.removeEventListener('error', this.handleError);
    }
  }

  handleConnectionNotification = (data) => {
    let notification = null;
    
    switch (data.status) {
      case 'connected':
        // No notification for successful connection to avoid clutter
        this.connectionNotificationShown = true;
        break;
      case 'error':
      case 'closed':
        this.connectionNotificationShown = false; // Reset for next connection
        if (!data.willReconnect) {
          notification = {
            severity: 'error',
            title: 'Connection Lost',
            message: 'Unable to maintain real-time connection',
            icon: <ErrorIcon />,
            autoHideDuration: 5000
          };
        }
        break;
      case 'failed':
        this.connectionNotificationShown = false; // Reset for next connection
        notification = {
          severity: 'error',
          title: 'Connection Failed',
          message: data.message || 'Failed to establish connection',
          icon: <ErrorIcon />,
          autoHideDuration: 8000
        };
        break;
      default:
        break;
    }
    
    if (notification) {
      this.showNotification(notification);
    }
  }

  handleAssignmentStarting = (data) => {
    this.showNotification({
      severity: 'info',
      title: 'Assignment Starting',
      message: data.message || 'Finding the best ride matches for you...',
      icon: <Assignment />,
      autoHideDuration: 4000
    });
  }

  handleAssignmentCompleted = (data) => {
    this.showNotification({
      severity: 'success',
      title: 'Assignment Completed',
      message: data.message || 'Your ride has been successfully assigned!',
      icon: <CheckCircle />,
      autoHideDuration: 6000,
      persistent: true
    });
  }

  handleAssignmentFailed = (data) => {
    this.showNotification({
      severity: 'error',
      title: 'Assignment Failed',
      message: data.message || 'Unable to assign a ride at this time',
      icon: <ErrorIcon />,
      autoHideDuration: 8000
    });
  }

  handleError = (data) => {
    // Only show non-connection errors
    if (data.type !== 'CONNECTION_ERROR') {
      this.showNotification({
        severity: 'error',
        title: 'Error',
        message: data.message || 'An unexpected error occurred',
        icon: <ErrorIcon />,
        autoHideDuration: 6000
      });
    }
  }

  showNotification = (notification) => {
    // Prevent duplicate notifications within a short time window
    const now = new Date();
    const isDuplicate = this.state.notifications.some(n => 
      n.title === notification.title && 
      n.message === notification.message &&
      (now - n.timestamp) < 2000 // 2 seconds window
    );
    
    if (isDuplicate) {
      console.log('🔕 Preventing duplicate notification:', notification.title);
      return;
    }

    const id = ++this.notificationId;
    const newNotification = {
      id,
      ...notification,
      timestamp: now
    };

    this.setState(prevState => ({
      notifications: [...prevState.notifications, newNotification]
    }));

    // Auto-hide after duration (if not persistent)
    if (!notification.persistent && notification.autoHideDuration) {
      setTimeout(() => {
        this.hideNotification(id);
      }, notification.autoHideDuration);
    }
  }

  hideNotification = (id) => {
    this.setState(prevState => ({
      notifications: prevState.notifications.filter(n => n.id !== id)
    }));
  }

  render() {
    const { notifications } = this.state;
    const { maxNotifications = 3 } = this.props;

    // Show only the most recent notifications
    const visibleNotifications = notifications.slice(-maxNotifications);

    return (
      <>
        {visibleNotifications.map((notification, index) => (
          <Snackbar
            key={notification.id}
            open={true}
            anchorOrigin={{ 
              vertical: 'top', 
              horizontal: 'center' 
            }}
            style={{
              top: `${80 + (index * 70)}px`, // Stack notifications
              zIndex: 9999 + index
            }}
            TransitionComponent={index === 0 ? SlideTransition : GrowTransition}
            TransitionProps={{
              timeout: 400
            }}
          >
            <Alert 
              severity={notification.severity}
              onClose={() => this.hideNotification(notification.id)}
              style={{
                minWidth: '300px',
                maxWidth: '500px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              icon={notification.icon || undefined}
              action={
                <IconButton
                  size="small"
                  aria-label="close"
                  color="inherit"
                  onClick={() => this.hideNotification(notification.id)}
                >
                  <Close fontSize="small" />
                </IconButton>
              }
            >
              {notification.title && (
                <AlertTitle style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  {notification.title}
                </AlertTitle>
              )}
              {notification.message}
            </Alert>
          </Snackbar>
        ))}
      </>
    );
  }
}

export default NotificationSystem;
