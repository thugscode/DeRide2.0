import React, { Component } from 'react';
import { 
  Box, 
  Typography, 
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Avatar,
  Fade,
  Grow
} from '@mui/material';
import { 
  Assignment,
  HourglassEmpty,
  CheckCircle,
  Error as ErrorIcon,
  DirectionsCar,
  People
} from '@mui/icons-material';

class AssignmentStatus extends Component {
  constructor(props) {
    super(props);
    this.state = {
      visible: false
    };
  }

  componentDidMount() {
    // Trigger fade-in animation
    setTimeout(() => {
      this.setState({ visible: true });
    }, 100);
  }

  getStatusConfig() {
    const { status, assignmentInProgress } = this.props;
    
    if (assignmentInProgress) {
      return {
        icon: <Assignment />,
        title: 'Assignment in Progress',
        subtitle: 'Our system is finding the best ride matches for you',
        color: '#2196F3',
        bgColor: '#e3f2fd',
        showProgress: true,
        animation: 'pulse'
      };
    }
    
    switch (status) {
      case 'waiting':
        return {
          icon: <HourglassEmpty />,
          title: 'Waiting for Assignment',
          subtitle: 'You will be notified automatically when your ride is assigned',
          color: '#FF9800',
          bgColor: '#fff3e0',
          showProgress: false,
          animation: 'none'
        };
      case 'completed':
        return {
          icon: <CheckCircle />,
          title: 'Assignment Completed',
          subtitle: 'Your ride has been successfully assigned! Check your ride details.',
          color: '#4CAF50',
          bgColor: '#e8f5e8',
          showProgress: false,
          animation: 'none'
        };
      case 'failed':
        return {
          icon: <ErrorIcon />,
          title: 'Assignment Failed',
          subtitle: 'Unable to assign a ride at this time. Please try again.',
          color: '#f44336',
          bgColor: '#ffebee',
          showProgress: false,
          animation: 'none'
        };
      default:
        return null;
    }
  }

  render() {
    const { 
      status, 
      assignmentInProgress, 
      userRole, 
      estimatedTime,
      style = {} 
    } = this.props;
    
    const { visible } = this.state;
    
    if (!status && !assignmentInProgress) {
      return null;
    }

    const config = this.getStatusConfig();
    if (!config) return null;

    return (
      <Fade in={visible} timeout={500}>
        <Grow in={visible} timeout={700}>
          <Card 
            style={{
              backgroundColor: config.bgColor,
              border: `2px solid ${config.color}33`,
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              ...style
            }}
          >
            <CardContent style={{ padding: '16px' }}>
              <Box display="flex" alignItems="center" marginBottom="12px">
                <Avatar 
                  style={{ 
                    backgroundColor: config.color,
                    marginRight: '12px',
                    width: '40px',
                    height: '40px'
                  }}
                >
                  {React.cloneElement(config.icon, { style: { color: 'white' } })}
                </Avatar>
                
                <Box flexGrow={1}>
                  <Typography 
                    variant="h6" 
                    style={{ 
                      color: config.color,
                      fontWeight: 'bold',
                      fontSize: '16px',
                      marginBottom: '4px'
                    }}
                  >
                    {config.title}
                  </Typography>
                  
                  <Typography 
                    variant="body2" 
                    style={{ 
                      color: '#666',
                      fontSize: '12px',
                      lineHeight: '1.4'
                    }}
                  >
                    {config.subtitle}
                  </Typography>
                </Box>
              </Box>

              {/* Progress Bar for Assignment in Progress */}
              {config.showProgress && (
                <Box marginBottom="12px">
                  <LinearProgress 
                    color="primary"
                    style={{
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(33, 150, 243, 0.2)'
                    }}
                  />
                  {estimatedTime && (
                    <Typography 
                      variant="caption" 
                      style={{ 
                        color: '#666',
                        fontSize: '10px',
                        marginTop: '4px',
                        display: 'block'
                      }}
                    >
                      Estimated time: {estimatedTime}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Role-specific information */}
              {userRole && (
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Chip
                    icon={userRole === 'driver' ? <DirectionsCar /> : <People />}
                    label={userRole === 'driver' ? 'Driver' : 'Rider'}
                    size="small"
                    style={{
                      backgroundColor: 'white',
                      color: config.color,
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}
                  />
                  
                  {assignmentInProgress && (
                    <Box display="flex" alignItems="center">
                      <div 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: config.color,
                          marginRight: '6px',
                          animation: 'pulse 1.5s ease-in-out infinite'
                        }}
                      />
                      <Typography 
                        variant="caption" 
                        style={{ 
                          color: config.color,
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                      >
                        Processing...
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
            
            <style jsx>{`
              @keyframes pulse {
                0% {
                  opacity: 1;
                  transform: scale(1);
                }
                50% {
                  opacity: 0.5;
                  transform: scale(1.2);
                }
                100% {
                  opacity: 1;
                  transform: scale(1);
                }
              }
            `}</style>
          </Card>
        </Grow>
      </Fade>
    );
  }
}

export default AssignmentStatus;
