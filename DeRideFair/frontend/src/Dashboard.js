import React, { Component, createRef } from 'react';
import {Box, IconButton, Input, Typography,
  Card, Button, RadioGroup, FormControlLabel, Radio, FormControl, Dialog, DialogTitle, DialogContent, DialogActions
} from '@material-ui/core';
import swal from 'sweetalert';
import { withRouter } from './utils';
import { VscAccount } from "react-icons/vsc";
import { BiSolidCoinStack } from "react-icons/bi";
import { FaLocationArrow, FaWindowMaximize, FaWindowMinimize } from 'react-icons/fa';
import { GoogleMap, Marker, Autocomplete, DirectionsRenderer, LoadScript } from '@react-google-maps/api';
import axios from 'axios';
import eventService from './EventService';
<<<<<<< Updated upstream
=======
import ConnectionStatus from './components/ConnectionStatus';
import AssignmentStatus from './components/AssignmentStatus';
import NotificationSystem from './components/NotificationSystem';
>>>>>>> Stashed changes

const center = {
  lat: 22.3146362,
  lng: 87.2995949
};

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2000';

class Dashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      token: '',
      source: '',
      destination: '',
      role: '',
      seats: '',
      threshold: '',
      loading: false,
      center: center,
      formSubmitted: false,
      userData: null,
      fetchedData: null,
      databaseUpdated: true, // Flag to track database update
      isLoaded: false,
      map: null,
      DriverPath: false,
      directionsResponse: null,
      distance: '',
      duration: '',
      assignmentTriggered: false,
      showRidersDialog: false,
<<<<<<< Updated upstream
      isConnectedToEvents: false,
      notifications: [],
=======
      websocketConnected: false,
      assignmentInProgress: false,
      waitingForAssignment: false,
      assignmentStatus: null, // 'waiting', 'completed', 'failed'
      connectionState: 'DISCONNECTED',
      connectionMessage: '',
      lastAssignmentUpdate: null,
>>>>>>> Stashed changes
    };
    this.originRef = createRef();
    this.destinationRef = createRef();
  }

  componentDidMount = () => {
    let token = sessionStorage.getItem('token');
    if (!token) {
      this.props.navigate("/login");
    } else {
      this.setState({ token: token, isLoaded: true });
      // Set authorization header for all axios requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      this.fetchUserData(token);
      
<<<<<<< Updated upstream
      // Connect to real-time events
      this.connectToEvents(token);
=======
      // Initialize WebSocket connection
      this.initializeWebSocket(token);
    }

    const savedState = sessionStorage.getItem('dashboardState');
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      if (parsedState.token === token) {
        this.setState({
          source: parsedState.source || '',
          destination: parsedState.destination || '',
          role: parsedState.role || '',
          seats: parsedState.seats || '',
          threshold: parsedState.threshold || '',
          formSubmitted: parsedState.formSubmitted || false,
          fetchedData: parsedState.fetchedData || null,
          databaseUpdated: parsedState.databaseUpdated !== undefined ? parsedState.databaseUpdated : true
        });
      }
>>>>>>> Stashed changes
    }
  }

  initializeWebSocket = async (token) => {
    try {
      // Connect to WebSocket
      await eventService.connect(token);
      console.log('✅ WebSocket connection established successfully');
    } catch (error) {
      console.error('❌ Failed to establish WebSocket connection:', error);
    }
    
    // Listen for connection state changes
    eventService.on('connectionState', this.handleConnectionState);
    
    // Listen for assignment-related events (only for state management, not notifications)
    eventService.on('ASSIGNMENT_STARTING', this.handleAssignmentStarting);
    eventService.on('ASSIGNMENT_COMPLETED', this.handleAssignmentCompleted);
    eventService.on('ASSIGNMENT_FAILED', this.handleAssignmentFailed);
    
    // Listen for general messages
    eventService.on('message', this.handleWebSocketMessage);
  }

  handleConnectionState = (data) => {
    console.log('🔌 WebSocket connection state changed:', data);
    this.setState({ 
      websocketConnected: data.connected,
      connectionState: data.state,
      connectionMessage: data.message
    });
  }

  handleAssignmentStarting = (data) => {
    console.log('🚗 Assignment starting:', data);
    this.setState({ 
      assignmentInProgress: true,
      waitingForAssignment: true,
      assignmentStatus: 'waiting',
      lastAssignmentUpdate: new Date()
    });
  }

  handleAssignmentCompleted = (data) => {
    console.log('✅ Assignment completed:', data);
    this.setState({ 
      assignmentInProgress: false,
      waitingForAssignment: false,
      assignmentStatus: 'completed',
      lastAssignmentUpdate: new Date()
    });
    
    // Automatically fetch the latest ride data after a short delay
    setTimeout(() => {
      this.fetchLatestRide();
    }, 2000);
    
    // Clear assignment status after showing success for a while
    setTimeout(() => {
      this.setState({ assignmentStatus: null });
    }, 10000);
  }

  handleAssignmentFailed = (data) => {
    console.log('❌ Assignment failed:', data);
    this.setState({ 
      assignmentInProgress: false,
      waitingForAssignment: false,
      assignmentStatus: 'failed',
      lastAssignmentUpdate: new Date()
    });
    
    // Clear assignment status after showing error for a while
    setTimeout(() => {
      this.setState({ assignmentStatus: null });
    }, 15000);
  }

  handleWebSocketMessage = (data) => {
    console.log('📨 WebSocket message:', data);
    // Handle other types of messages if needed
  }

  calculateRoute = async () => {
    if (
      !this.state.source ||
      !this.state.destination
    ) {
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    const results = await directionsService.route({
      origin: this.state.source,
      destination: this.state.destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
    });

    this.setState({
      directionsResponse: results,
      distance: results.routes[0].legs[0].distance.text,
      duration: results.routes[0].legs[0].duration.text,
    });
  };

  clearRoute = () => {
    this.setState({
      DriverPath: false,
      directionsResponse: null,
      distance: '',
      duration: '',
    });
    if (this.originRef.current) this.originRef.current.value = '';
    if (this.destinationRef.current) this.destinationRef.current.value = '';
  };

  showRoute = async () => {
    if (!this.state.fetchedData) {
      swal({
        text: 'No route data available. Please get your assigned ride first.',
        icon: "warning",
        type: "warning",
      });
      return;
    }

<<<<<<< Updated upstream
    // For drivers, build waypoints from assigned riders' source and destination points
    let waypoints = [];
    if (
      this.state.fetchedData.Role === 'driver' &&
      this.state.fetchedData.Riders &&
      Array.isArray(this.state.fetchedData.Riders)
    ) {
      this.state.fetchedData.Riders.forEach((rider) => {
        let riderData;
        if (typeof rider === 'object' && rider !== null && rider.Source && rider.Destination) {
          riderData = rider;
        } else if (typeof rider === 'object' && rider !== null) {
          // Handle the format where rider is an object with user as key
          const entries = Object.entries(rider);
          if (entries.length > 0) {
            const [_, details] = entries[0];
            riderData = details;
          }
        }
        
        if (riderData?.Source) {
          waypoints.push({
            location: { 
              lat: parseFloat(riderData.Source.lat), 
              lng: parseFloat(riderData.Source.lng) 
            },
            stopover: true,
=======
    // For drivers, use Google Maps API with waypoints for all riders
    if (this.state.fetchedData.Role === 'driver') {
      await this.showDriverRouteWithWaypoints();
      return;
    }

    // For riders, show the existing route logic
    await this.showRiderRoute();
  }

  showDriverRouteWithWaypoints = async () => {
    try {
      // Driver's source and destination
      const driverSource = this.state.fetchedData.Source;
      const driverDestination = this.state.fetchedData.Destination;

      if (!driverSource || !driverDestination) {
        swal({
          text: 'Driver source or destination not available.',
          icon: "warning",
          type: "warning",
        });
        return;
      }

      // Collect all riders' source and destination points as waypoints
      let waypoints = [];
      
      if (this.state.fetchedData.Riders && Array.isArray(this.state.fetchedData.Riders)) {
        this.state.fetchedData.Riders.forEach(rider => {
          const username = Object.keys(rider)[0];
          const riderData = rider[username];
          
          if (riderData.Source && riderData.Source.lat && riderData.Source.lng) {
            waypoints.push({
              location: {
                lat: parseFloat(riderData.Source.lat),
                lng: parseFloat(riderData.Source.lng)
              },
              stopover: true
            });
          }
          
          if (riderData.Destination && riderData.Destination.lat && riderData.Destination.lng) {
            waypoints.push({
              location: {
                lat: parseFloat(riderData.Destination.lat),
                lng: parseFloat(riderData.Destination.lng)
              },
              stopover: true
            });
          }
        });
      }

      // Remove duplicate waypoints (same location)
      waypoints = waypoints.filter((waypoint, index, self) => 
        index === self.findIndex(w => 
          Math.abs(w.location.lat - waypoint.location.lat) < 0.0001 && 
          Math.abs(w.location.lng - waypoint.location.lng) < 0.0001
        )
      );

      // Limit waypoints to 25 (Google Maps API limit)
      if (waypoints.length > 25) {
        waypoints = waypoints.slice(0, 25);
        swal({
          text: `Too many pickup/drop points. Showing optimized route for first 25 locations.`,
          icon: "info",
          type: "info",
        });
      }

      console.log(`🗺️ Creating driver route with ${waypoints.length} waypoints for ${this.state.fetchedData.Riders?.length || 0} riders`);

      const directionsService = new window.google.maps.DirectionsService();
      const results = await directionsService.route({
        origin: {
          lat: parseFloat(driverSource.lat),
          lng: parseFloat(driverSource.lng)
        },
        destination: {
          lat: parseFloat(driverDestination.lat),
          lng: parseFloat(driverDestination.lng)
        },
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true // Google will optimize the order of waypoints
      });

      // Calculate total distance and duration across all legs
      let totalDistance = 0;
      let totalDuration = 0;
      
      results.routes[0].legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      // Convert to readable format
      const distanceText = totalDistance >= 1000 
        ? `${(totalDistance / 1000).toFixed(1)} km`
        : `${totalDistance} m`;
      
      const durationText = totalDuration >= 3600 
        ? `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`
        : `${Math.floor(totalDuration / 60)}m`;

      this.setState({
        DriverPath: true,
        directionsResponse: results,
        distance: distanceText,
        duration: durationText,
      });

      swal({
        text: `Route calculated with ${waypoints.length} pickup/drop points. Distance: ${distanceText}, Duration: ${durationText}`,
        icon: "success",
        type: "success",
      });

    } catch (error) {
      console.error('❌ Error showing driver route:', error);
      swal({
        text: 'Unable to calculate optimized route: ' + error.message,
        icon: "error",
        type: "error",
      });
    }
  }

  showRiderRoute = async () => {
    // Filter out empty path objects and validate coordinates
    let validPath = [];
    if (this.state.fetchedData.Path && Array.isArray(this.state.fetchedData.Path)) {
      validPath = this.state.fetchedData.Path.filter(point => 
        point && 
        typeof point.lat !== 'undefined' && 
        typeof point.lng !== 'undefined' &&
        point.lat !== null && 
        point.lng !== null &&
        !isNaN(parseFloat(point.lat)) && 
        !isNaN(parseFloat(point.lng))
      );
    }

    if (validPath.length < 2) {
      swal({
        text: 'Showing direct route instead of optimized path.',
        icon: "success",
        type: "success",
      });
      // Fall back to direct route from source to destination
      if (this.state.fetchedData.Source && this.state.fetchedData.Destination) {
        try {
          const directionsService = new window.google.maps.DirectionsService();
          const results = await directionsService.route({
            origin: this.state.fetchedData.Source,
            destination: this.state.fetchedData.Destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          });

          this.setState({
            DriverPath: true,
            directionsResponse: results,
            distance: results.routes[0].legs[0].distance.text,
            duration: results.routes[0].legs[0].duration.text,
>>>>>>> Stashed changes
          });
        }
        if (riderData?.Destination) {
          waypoints.push({
            location: { 
              lat: parseFloat(riderData.Destination.lat), 
              lng: parseFloat(riderData.Destination.lng) 
            },
            stopover: true,
          });
        }
      });
      
      // Limit waypoints to 25 (Google Maps API limit)
      if (waypoints.length > 25) {
        waypoints = waypoints.slice(0, 25);
      }
    }

    // Use driver's/user's source and destination as origin and destination
    const origin = this.state.fetchedData.Source
      ? { lat: parseFloat(this.state.fetchedData.Source.lat), lng: parseFloat(this.state.fetchedData.Source.lng) }
      : null;
    const destination = this.state.fetchedData.Destination
      ? { lat: parseFloat(this.state.fetchedData.Destination.lat), lng: parseFloat(this.state.fetchedData.Destination.lng) }
      : null;

    if (!origin || !destination) {
      swal({
        text: 'Source or destination coordinates missing.',
        icon: "warning",
        type: "warning",
      });
      return;
    }

    try {
      const directionsService = new window.google.maps.DirectionsService();
      const results = await directionsService.route({
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      });

      // Calculate total distance and duration
      let totalDistance = 0;
      let totalDuration = 0;
      results.routes[0].legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      // Convert to readable format
      const distanceText = totalDistance >= 1000 
        ? `${(totalDistance / 1000).toFixed(1)} km`
        : `${totalDistance} m`;
      const durationText = totalDuration >= 3600 
        ? `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`
        : `${Math.floor(totalDuration / 60)}m`;

      this.setState({
        DriverPath: true,
        directionsResponse: results,
        distance: distanceText,
        duration: durationText,
      });

      if (this.state.fetchedData.Role === 'driver' && waypoints.length > 0) {
        swal({
          text: `Route optimized with ${waypoints.length} rider pickup/dropoff points!`,
          icon: "success",
          type: "success",
        });
      }
    } catch (error) {
      swal({
        text: 'Unable to show route: ' + error.message,
        icon: "error",
        type: "error",
      });
    }
  };

  fetchUserData = (token) => {
    axios.get(`${API_BASE_URL}/GetUser`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'content-type': 'application/json'
      }
    }).then((res) => {
      this.setState({ userData: res.data.result });
    }).catch((error) => {
      console.error('Failed to fetch user data:', error);
      
      const errorMessage = error.response?.data?.errorMessage || "Failed to load user data";
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        swal({
          title: "Session Expired",
          text: "Your session has expired. Please login again.",
          icon: "warning",
          buttons: {
            login: {
              text: "Go to Login",
              value: "login",
              className: "swal-button--confirm",
            }
          },
        }).then((value) => {
          if (value === "login") {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('dashboardState');
            this.props.navigate("/");
          }
        });
      } else if (error.response?.data?.errorMessage?.includes('logged out')) {
        swal({
          title: "Account Issue",
          text: errorMessage + " Please login again.",
          icon: "warning",
          buttons: {
            login: {
              text: "Go to Login", 
              value: "login",
              className: "swal-button--confirm",
            }
          },
        }).then((value) => {
          if (value === "login") {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('dashboardState');
            this.props.navigate("/");
          }
        });
      } else {
        swal({
          text: errorMessage,
          icon: "error",
          type: "error"
        });
      }
    });
  }

  componentDidUpdate = (prevState) => {
    const stateToSave = {
      token: this.state.token,
      source: this.state.source,
      destination: this.state.destination,
      role: this.state.role,
      seats: this.state.seats,
      threshold: this.state.threshold,
      formSubmitted: this.state.formSubmitted,
      fetchedData: this.state.fetchedData,
      databaseUpdated: this.state.databaseUpdated
    };

    if (JSON.stringify(prevState) !== JSON.stringify(stateToSave)) {
      sessionStorage.setItem('dashboardState', JSON.stringify(stateToSave));
    }
  };

  getAddress = (location, type) => {
    const { lat, lng } = location; // Destructure lat and lng from the location object
    const geocoder = new window.google.maps.Geocoder();
    const latLng = { lat: parseFloat(lat), lng: parseFloat(lng) };
  
    geocoder.geocode({ location: latLng }, (results, status) => {
      if (status === 'OK') {
        if (results[0] && type === 'source') {
          this.setState({ source: results[0].formatted_address });
        } else if(results[0] && type === 'destination') {
          this.setState({ destination: results[0].formatted_address });
        }
      } else {
        this.setState({ address: 'Geocode failed due to: ' + status });
      }
    });
  };
  

  componentWillUnmount = () => {
<<<<<<< Updated upstream
    // Disconnect from event service
    eventService.disconnect();
  }

  connectToEvents = (token) => {
    console.log('🔌 Setting up real-time WebSocket event listeners...');
    
    // Connect to WebSocket
    eventService.connect(token);
    
    // Set up event listeners
    eventService.on('CONNECTED', this.handleEventConnected);
    eventService.on('ASSIGNMENT_TRIGGERED', this.handleAssignmentTriggered);
    eventService.on('ASSIGNMENT_STARTING', this.handleAssignmentStarting);
    eventService.on('ASSIGNMENT_COMPLETED', this.handleAssignmentCompleted);
    eventService.on('ASSIGNMENT_FAILED', this.handleAssignmentFailed);
    eventService.on('RIDE_UPDATED', this.handleRideUpdated);
    eventService.on('RIDE_SAVED', this.handleRideSaved);
    eventService.on('connection', this.handleConnectionStatus);
    eventService.on('error', this.handleEventError);
  }

  handleEventConnected = (data) => {
    console.log('📡 Connected to real-time WebSocket notifications:', data);
    this.setState({ isConnectedToEvents: true });
  }

  handleAssignmentTriggered = (data) => {
    console.log('🎯 Assignment triggered notification:', data);
    
    swal({
      title: "Assignment Triggered!",
      text: data.message,
      icon: "info",
      timer: 3000,
      buttons: false
    });
  }

  handleAssignmentStarting = (data) => {
    console.log('🚀 Assignment starting notification:', data);
    
    swal({
      title: "Assignment Starting!",
      text: data.message,
      icon: "info",
      timer: 3000,
      buttons: false
    });
  }

  handleAssignmentCompleted = (data) => {
    console.log('🎉 Assignment completed notification:', data);
    
    swal({
      title: "Assignment Complete!",
      text: data.message,
      icon: "success",
      buttons: {
        check: {
          text: "Check My Ride",
          value: "check",
          className: "swal-button--confirm",
        },
        later: {
          text: "Later",
          value: "later",
        }
      },
    }).then((value) => {
      if (value === "check") {
        this.fetchLatestRideAndUpdateDatabase();
      }
    });
  }

  handleAssignmentFailed = (data) => {
    console.log('❌ Assignment failed notification:', data);
    
    swal({
      title: "Assignment Failed",
      text: data.message,
      icon: "error",
      buttons: {
        retry: {
          text: "Try Again",
          value: "retry",
          className: "swal-button--confirm",
        },
        ok: {
          text: "OK",
          value: "ok",
        }
      },
    }).then((value) => {
      if (value === "retry") {
        // Reset form to allow user to resubmit
        this.setState({ formSubmitted: false, assignmentTriggered: false });
      }
    });
  }

  handleRideUpdated = (data) => {
    console.log('📝 Ride updated notification:', data);
    swal({
      text: data.message,
      icon: "success",
      type: "success",
    });
  }

  handleRideSaved = (data) => {
    console.log('💾 Ride saved notification:', data);
    swal({
      text: data.message,
      icon: "success",
      type: "success",
    });
    
    // Mark as database updated since we got confirmation
    this.setState({ databaseUpdated: true });
  }

  handleConnectionStatus = (data) => {
    console.log('🔌 Connection status:', data);
    this.setState({ isConnectedToEvents: data.status === 'connected' });
  }

  handleEventError = (data) => {
    console.error('❌ Event service error:', data);
    this.setState({ isConnectedToEvents: false });
=======
    // Clean up WebSocket event listeners
    eventService.removeEventListener('connectionState', this.handleConnectionState);
    eventService.removeEventListener('ASSIGNMENT_STARTING', this.handleAssignmentStarting);
    eventService.removeEventListener('ASSIGNMENT_COMPLETED', this.handleAssignmentCompleted);
    eventService.removeEventListener('ASSIGNMENT_FAILED', this.handleAssignmentFailed);
    eventService.removeEventListener('message', this.handleWebSocketMessage);
    
    // Disconnect WebSocket
    eventService.disconnect();
>>>>>>> Stashed changes
  }

  logOut = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('dashboardState');
    
<<<<<<< Updated upstream
    // Disconnect from event service
=======
    // Clean up WebSocket
>>>>>>> Stashed changes
    eventService.disconnect();
    
    // Clear form state
    this.setState({
      token: '',
      source: '',
      destination: '',
      role: '',
      seats: '',
      threshold: '',
      loading: false,
      center: center,
      formSubmitted: false,
      userData: null,
      fetchedData: null,
      databaseUpdated: true,
      assignmentTriggered: false,
      directionsResponse: null,
      distance: '',
      duration: '',
      DriverPath: false,
      showRidersDialog: false,
      websocketConnected: false,
      assignmentInProgress: false,
      waitingForAssignment: false,
    });
    
    this.props.navigate("/");
  }

  onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'role') {
      if (value === 'driver') {
        this.setState({ role: value });
      } else if (value === 'rider') {
        this.setState({ role: value, seats: '0', threshold: '0' });
      }
    } else {
      this.setState({ [name]: value });
    }
  };

  addRideRequest = async (e) => {
    e.preventDefault();

    const { source, destination, role, seats, threshold, userData } = this.state;
    if (!source || !destination || !role || (role === 'driver' && (!seats || !threshold))) {
      swal({
        text: 'Please fill out all required fields.',
        icon: "warning",
        type: "warning",
      });
      return;
    }

    // Validate driver fields
    if (role === 'driver') {
      if (parseInt(seats) <= 0) {
        swal({
          text: 'Seats must be greater than 0',
          icon: "warning",
          type: "warning",
        });
        return;
      }
      if (parseInt(threshold) <= 0) {
        swal({
          text: 'Threshold must be greater than 0',
          icon: "warning",
          type: "warning",
        });
        return;
      }
    }

    if (userData && userData.Token === 0) {
      swal({
        text: "Please provide a ride first.",
        icon: "warning",
        type: "warning",
      });
      return;
    }

    this.setState({ loading: true });

    try {
      const sourceCoords = await this.geocodeAddress(source);
      const destinationCoords = await this.geocodeAddress(destination);
      
      const userDataPayload = {
        source: sourceCoords,
        destination: destinationCoords,
        role,
        seats: role === 'driver' ? parseInt(seats) : 0,
        threshold: role === 'driver' ? parseInt(threshold) : 0,
      };
  
      const response = await axios.post(`${API_BASE_URL}/update-user`, userDataPayload, {
        headers: {
          'Authorization': `Bearer ${this.state.token}`,
        }
      });

      this.setState({ loading: false });
      
      swal({
        text: response.data.title,
        icon: "success",
        type: "success",
      });

<<<<<<< Updated upstream
      // Event-driven: If assignment is triggered, wait for notification
      if (response.data.assignmentTriggered) {
        this.setState({ 
          formSubmitted: true, 
          databaseUpdated: false, 
          assignmentTriggered: true 
        });
        
        swal({
          title: "Assignment Triggered!",
          text: "Assignment process has been started. You will be notified when it's complete.",
          icon: "info",
          type: "info",
        });
      } else {
        this.setState({ 
          formSubmitted: true, 
          databaseUpdated: false, 
          assignmentTriggered: false 
        });
        
        swal({
          text: "Ride request submitted. Please wait for other users to join for assignment.",
          icon: "info",
          type: "info",
        });
=======
      this.setState({ 
        formSubmitted: true, 
        databaseUpdated: false,
        assignmentTriggered: response.data.assignmentTriggered || false,
        waitingForAssignment: response.data.assignmentTriggered || false,
        assignmentStatus: response.data.assignmentTriggered ? 'waiting' : null
      });
      
      // WebSocket will handle real-time notifications
      if (response.data.assignmentTriggered) {
        console.log('🚗 Assignment triggered by server, waiting for WebSocket notifications...');
>>>>>>> Stashed changes
      }

    } catch (error) {
      this.setState({ loading: false });
      console.error('Update user error:', error);
      
      const errorMessage = error.response?.data?.errorMessage || "Failed to submit ride request. Please try again.";
      swal({
        text: errorMessage,
        icon: "error",
        type: "error",
      });
    }
  };

  geocodeAddress = (address) => {
    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: address }, (results, status) => {
        if (status === 'OK') {
          const location = results[0].geometry.location;
          // Return in the format expected by the server
          resolve({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          reject(new Error('Geocode was not successful for the following reason: ' + status));
        }
      });
    });
  };

  resetFields = () => {
    this.setState({
      source: '',
      destination: '',
      role: '',
      seats: '',
      threshold: '',
      formSubmitted: false,
      fetchedData: null,
      databaseUpdated: true,
      assignmentTriggered: false,
      directionsResponse: null,
      distance: '',
      duration: '',
      DriverPath: false,
      loading: false,
      showRidersDialog: false,
      assignmentInProgress: false,
      waitingForAssignment: false,
      assignmentStatus: null,
    });
  }

<<<<<<< Updated upstream
  fetchLatestRideAndUpdateDatabase = () => {
    // Event-driven: Fetch latest ride and update database once assignment is done
    if (this.state.loading) {
      return;
    }
    
    this.setState({ loading: true });
    
    // Show loading message
    swal({
      title: "Processing Assignment",
      text: "Fetching your assigned ride...",
      icon: "info",
      buttons: false,
      closeOnClickOutside: false,
      closeOnEsc: false
    });
    
    axios.get(`${API_BASE_URL}/GetUser`, {
      headers: {
        'Authorization': `Bearer ${this.state.token}`,
        'content-type': 'application/json'
      }
    }).then((res) => {
      this.setState({ loading: false });
      const fetchedData = res.data.result;
      
      // Update source and destination addresses from coordinates
      this.getAddress(fetchedData.Source, 'source');
      this.getAddress(fetchedData.Destination, 'destination');
      
      if (fetchedData.Assigned) {
        this.setState({ 
          fetchedData: fetchedData, 
          formSubmitted: false
        });
        
        swal.close();
        // Automatically update database since assignment is complete
        this.updateDatabase();
      } else {
        swal.close();
        swal({
          text: 'Assignment is still in progress. Please check back in a moment.',
          icon: "info",
          type: "info",
        });
        
        // Retry after a delay if assignment not complete
        setTimeout(() => {
          this.fetchLatestRideAndUpdateDatabase();
        }, 5000);
      }
    }).catch((err) => {
      this.setState({ loading: false });
      swal.close();
      console.error('Failed to fetch latest ride:', err);
      
      const errorMessage = err.response?.data?.errorMessage || "Failed to fetch ride data";
      
      if (err.response?.status === 401) {
        swal({
          title: "Session Expired",
          text: "Your session has expired. Please login again.",
          icon: "warning",
          buttons: {
            login: {
              text: "Go to Login",
              value: "login",
              className: "swal-button--confirm",
            }
          },
        }).then((value) => {
          if (value === "login") {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('dashboardState');
            this.props.navigate("/");
          }
        });
      } else {
        swal({
          text: errorMessage,
          icon: "error",
          type: "error",
        });
      }
    });
  };

  // Manual fetch method for "Get Ride" button
=======
>>>>>>> Stashed changes
  fetchLatestRide = () => {
    // Prevent multiple concurrent calls
    if (this.state.loading) {
      return;
    }
    
    this.setState({ loading: true });
    
    axios.get(`${API_BASE_URL}/GetUser`, {
      headers: {
        'Authorization': `Bearer ${this.state.token}`,
        'content-type': 'application/json'
      }
    }).then((res) => {
      this.setState({ loading: false });
      const fetchedData = res.data.result;
      
      // Update source and destination addresses from coordinates
      this.getAddress(fetchedData.Source, 'source');
      this.getAddress(fetchedData.Destination, 'destination');
      
      if (!fetchedData.Assigned) {
        swal({
          text: 'No ride is available for you yet. Please wait for assignment or check back later.',
          icon: "info",
          type: "info",
        });
        return;
      }

      this.setState({ 
        fetchedData: fetchedData, 
        formSubmitted: false
      });
      
      // Automatically update database if not already updated
      if (!this.state.databaseUpdated) {
<<<<<<< Updated upstream
        this.updateDatabase();
=======
        this.setState({ 
          fetchedData: fetchedData, 
          waitingForAssignment: false,
          formSubmitted: false
        });
        this.updateDatabase(); // Update database here
      } else {
        this.setState({
          fetchedData: fetchedData,
          waitingForAssignment: false,
          formSubmitted: false
        });
>>>>>>> Stashed changes
      }
    }).catch((err) => {
      this.setState({ loading: false });
      console.error('Failed to fetch latest ride:', err);
      
      const errorMessage = err.response?.data?.errorMessage || "Failed to fetch ride data";
      
      if (err.response?.status === 401) {
        swal({
          title: "Session Expired",
          text: "Your session has expired. Please login again.",
          icon: "warning",
          buttons: {
            login: {
              text: "Go to Login",
              value: "login",
              className: "swal-button--confirm",
            }
          },
        }).then((value) => {
          if (value === "login") {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('dashboardState');
            this.props.navigate("/");
          }
        });
      } else {
        swal({
          text: errorMessage,
          icon: "error",
          type: "error",
        });
      }
    });
  };
  

  updateDatabase = () => {
    // Prevent multiple concurrent database updates
    if (this.state.loading) {
      return;
    }
    
    if (!this.state.fetchedData) {
      swal({
        text: 'No ride data available to save. Please get your assigned ride first.',
        icon: "warning",
        type: "warning",
      });
      return;
    }

    if (!this.state.fetchedData.Assigned) {
      swal({
        text: 'You have not been assigned to any ride yet. Please wait for assignment.',
        icon: "info",
        type: "info",
      });
      return;
    }

    // Check if already updated to prevent duplicates
    if (this.state.databaseUpdated) {
      swal({
        text: 'Ride has already been saved to history.',
        icon: "info",
        type: "info",
      });
      return;
    }

    this.setState({ loading: true });

    axios.post(`${API_BASE_URL}/update-database`, {}, {
      headers: {
        'Authorization': `Bearer ${this.state.token}`,
      }
    }).then((res) => {
      this.setState({ loading: false });
      if (res.data.status) {
        swal({
          text: res.data.message || 'Hurray! Your ride has been saved to history!',
          icon: "success",
          type: "success",
        });
        // Mark as database updated ONLY after successful response
        this.setState({ databaseUpdated: true });
      } else {
        swal({
          text: res.data.errorMessage || 'Ride assignment is still in progress',
          icon: "info",
          type: "info",
        });
        // Don't mark as updated if the update failed
      }
    }).catch((err) => {
      this.setState({ loading: false });
      console.error('Database update error:', err);
      const errorMessage = err.response?.data?.errorMessage || 'Error updating the database';
      
      if (err.response?.status === 401) {
        swal({
          title: "Session Expired",
          text: "Your session has expired. Please login again.",
          icon: "warning",
          buttons: {
            login: {
              text: "Go to Login",
              value: "login",
              className: "swal-button--confirm",
            }
          },
        }).then((value) => {
          if (value === "login") {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('dashboardState');
            this.props.navigate("/");
          }
        });
      } else {
        swal({
          text: errorMessage,
          icon: "error",
          type: "error",
        });
      }
    });
  };

  render() {
    // Check if Google Maps API key is available
    if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Google Maps Configuration Error</h2>
          <p>Google Maps API key is missing. Please check your .env file.</p>
        </div>
      );
    }

    const textFieldStyle = {
      fontSize: '20px',
      padding: '10px'
    };

    return (
      <LoadScript
        googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}
        libraries={['places']}
        onLoad={() => {
<<<<<<< Updated upstream
          console.log('Google Maps script loaded successfully');
=======
          console.log('Google Maps loaded successfully');
>>>>>>> Stashed changes
        }}
        onError={(error) => {
          console.error('Google Maps loading error:', error);
        }}
      >
        {/* Professional Notification System */}
        <NotificationSystem 
          eventService={eventService}
          maxNotifications={3}
        />
        
        <Box
          position="relative"
          display="flex"
          flexDirection="column"
          alignItems="center"
          height="98vh"
          width="99vw"
        >
          <Box position="absolute" left={0} top={0} height="100%" width="100%">
            <GoogleMap
              zoom={16}
              center={this.state.center}
              mapContainerStyle={{ width: '100%', height: '100%' }}
              options={{
                zoomControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
              onLoad={(map) => {
                this.setState({ map });
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const currentLocation = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                    };
                    this.setState({ center: currentLocation });
                    map.panTo(currentLocation);
                  },
                  () => {
                    swal({
                      text: 'Error fetching your location',
                      icon: "error",
                      type: "error",
                    });
                  }
                );
              }}
            >
              {this.state.directionsResponse && (
                <DirectionsRenderer directions={this.state.directionsResponse} />
              )}
              {navigator.geolocation && this.state.center && (
                <Marker
                  position={this.state.center}
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                  }}
                />
              )}
              {this.state.fetchedData && this.state.DriverPath && this.state.fetchedData.Riders && Array.isArray(this.state.fetchedData.Riders) && this.state.fetchedData.Riders.map((rider, index) => {
                // Handle different rider data formats from server
                let riderData;
                if (typeof rider === 'string') {
                  return null; // Skip if no location data
                } else if (typeof rider === 'object' && rider !== null && rider.Source && rider.Destination) {
                  riderData = rider;
                } else if (typeof rider === 'object' && rider !== null) {
                  // Handle the format where rider is an object with user as key
                  const entries = Object.entries(rider);
                  if (entries.length > 0) {
                    // eslint-disable-next-line no-unused-vars
                    const [user, details] = entries[0];
                    riderData = {
                      Source: details?.Source,
                      Destination: details?.Destination
                    };
                  }
                }
                
                if (!riderData?.Source || !riderData?.Destination) {
                  return null; // Skip if no location data
                }
                
                return (
                  <React.Fragment key={index}>
                    <Marker
                      position={{
                        lat: riderData.Source.lat,
                        lng: riderData.Source.lng
                      }}
                      icon={{
                        url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                      }}
                    />
                    <Marker
                      position={{
                        lat: riderData.Destination.lat,
                        lng: riderData.Destination.lng
                      }}
                      icon={{
                        url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </GoogleMap>
          </Box>
        <Box
          position="absolute"
          top={9}
          right={9}
          padding={5}
          borderRadius={10}
          bgcolor="white"
          boxShadow={2}
          minWidth="140px"
          zIndex={1}
          display="flex"
          flexDirection="column"
        >
          <IconButton
            style={{ position: 'absolute', top: 0, right: 0 }}
            onClick={() => this.setState({ minimized: !this.state.minimized })}
          >
            {this.state.minimized ? <FaWindowMaximize /> : <FaWindowMinimize />}
          </IconButton>
          {!this.state.minimized && (
            <>
              {/* Global Connection Status */}
              <Box marginBottom="8px">
                <ConnectionStatus 
                  compact={false}
                  showDetails={true}
                  style={{ fontSize: '11px' }}
                />
              </Box>
              
              {this.state.formSubmitted ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {this.state.userData && (
                      <Card style={{ textAlign: 'left', padding: '5px' }}>
                        <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
                        <Typography variant="caption" style={{ 
                          color: this.state.websocketConnected ? '#4CAF50' : '#f44336',
                          fontSize: '10px'
                        }}>
                          {this.state.websocketConnected ? '🟢 Real-time' : '🔴 Offline'}
                        </Typography>
                      </Card>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                      {/* Real-time connection status */}
                      <div style={{ 
                        backgroundColor: this.state.isConnectedToEvents ? '#4CAF50' : '#f44336', 
                        color: 'white', 
                        padding: '2px 6px', 
                        borderRadius: '10px', 
                        fontSize: '10px',
                        marginRight: '10px'
                      }}>
                        {this.state.isConnectedToEvents ? '🟢 Live' : '🔴 Offline'}
                      </div>
                      <Button
                        className="button_style"
                        variant="contained"
                        style={{ backgroundColor: '#4CAF50', color: 'white', marginRight: '10px' }}
                        size="small"
                        onClick={() => this.props.navigate("/history")}
                      >
                        History
                      </Button>
                      <Button
                        className="button_style"
                        variant="contained"
                        size="small"
                        style={{ backgroundColor: 'red', color: 'white' }}
                        onClick={this.logOut}
                      >
                        Log Out
                      </Button>
                    </div>
                  </div>
                  <div style={{ padding: '20px', boxSizing: 'border-box' }}>
                    <h3>Submitted Ride Details</h3>
                    <p>Source: {this.state.source}</p>
                    <p>Destination: {this.state.destination}</p>
                    <p>Role: {this.state.role}</p>
                    {this.state.role === 'driver' && (
                      <div>
                        <p>Seats: {this.state.seats}</p>
                        <p>Threshold: {this.state.threshold}</p>
                      </div>
                    )}
<<<<<<< Updated upstream
                    {this.state.assignmentTriggered && (
                      <div style={{ margin: '20px 0', textAlign: 'center' }}>
                        <Typography variant="body2" style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                          <span role="img" aria-label="loading">🔄</span> Assignment in progress... Please wait.
                        </Typography>
                      </div>
=======
                    
                    {/* Professional Assignment Status */}
                    {(this.state.waitingForAssignment || this.state.assignmentStatus) && (
                      <AssignmentStatus 
                        status={this.state.assignmentStatus}
                        assignmentInProgress={this.state.assignmentInProgress}
                        userRole={this.state.role}
                        estimatedTime="2-3 minutes"
                        style={{ margin: '16px 0' }}
                      />
>>>>>>> Stashed changes
                    )}

                    <Button
                      style={{ backgroundColor: '#4CAF50', color: 'white', marginLeft: '10px' }}
                      onClick={this.fetchLatestRide}
                      disabled={this.state.loading}
                    >
                      {this.state.loading ? 'Checking...' : 'Check Assignment'}
                    </Button>
                    <Button
                      style={{ backgroundColor: '#f44336', color: 'white', marginLeft: '10px' }}
                      onClick={this.resetFields}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (this.state.fetchedData ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {this.state.userData && (
                      <Card style={{ textAlign: 'left', padding: '5px' }}>
                        <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
                        <Typography variant="caption" style={{ 
                          color: this.state.websocketConnected ? '#4CAF50' : '#f44336',
                          fontSize: '10px'
                        }}>
                          {this.state.websocketConnected ? '🟢 Real-time' : '🔴 Offline'}
                        </Typography>
                      </Card>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <Button
                        className="button_style"
                        variant="contained"
                        style={{ backgroundColor: '#4CAF50', color: 'white', marginRight: '10px' }}
                        size="small"
                        onClick={() => this.props.navigate("/history")}
                      >
                        History
                      </Button>
                      <Button
                        className="button_style"
                        variant="contained"
                        size="small"
                        style={{ backgroundColor: 'red', color: 'white' }}
                        onClick={this.logOut}
                      >
                        Log Out
                      </Button>
                    </div>
                  </div>
                  <div style={{ padding: '20px', boxSizing: 'border-box' }}>
                    <h3>Assigned Ride Details</h3>
                    <p>Source: {this.state.source}</p>
                    <p>Destination: {this.state.destination}</p>
                    <p>Role: {this.state.fetchedData.Role}</p>
                    {this.state.fetchedData.Role === 'driver' && (
                      <div>
                        <p>Remaining Seats: {this.state.fetchedData.Seats}</p>
                        <Button
                          style={{ backgroundColor: '#4CAF50', color: 'white', marginLeft: '10px' }}
                          onClick={this.showRoute}
                        >
                          Show Path
                        </Button>
                        <Button
                          style={{ backgroundColor: '#4CAF50', color: 'white', marginLeft: '10px' }}
                          onClick={() => this.setState({ showRidersDialog: true })}
                        >
                          Riders List
                        </Button>
                        <Dialog
                          open={this.state.showRidersDialog}
                          onClose={() => this.setState({ showRidersDialog: false })}
                        >
                          <DialogTitle>Riders List</DialogTitle>
                          <DialogContent>
                            {this.state.fetchedData.Riders.map((rider, index) => (
                              <div key={index}>
                                <p>User: {Object.keys(rider)[0]}</p>
                                <p>Source: {rider[Object.keys(rider)[0]].Source.lat}, {rider[Object.keys(rider)[0]].Source.lng}</p>
                                <p>Destination: {rider[Object.keys(rider)[0]].Destination.lat}, {rider[Object.keys(rider)[0]].Destination.lng}</p>
                                <hr />
                              </div>
                            ))}
                          </DialogContent>
                          <DialogActions>
                            <Button onClick={() => this.setState({ showRidersDialog: false })} color="primary">
                              Close
                            </Button>
                          </DialogActions>
                        </Dialog>
                      </div>
                    )}
                    {this.state.fetchedData.Role === 'rider' && (
                      <div>
                        <Button
                          style={{ backgroundColor: '#4CAF50', color: 'white', marginLeft: '10px' }}
                          onClick={() => {
                            const driverInfo = this.state.fetchedData.Driver;
                            let driverText;
                            
                            if (typeof driverInfo === 'string') {
                              driverText = `Driver ID: ${driverInfo}`;
                            } else if (typeof driverInfo === 'object' && driverInfo) {
                              driverText = `Driver ID: ${driverInfo.ID || 'Unknown'}`;
                              if (driverInfo.Source && driverInfo.Destination) {
                                driverText += `\nDriver Source: ${driverInfo.Source.lat || 'N/A'}, ${driverInfo.Source.lng || 'N/A'}`;
                                driverText += `\nDriver Destination: ${driverInfo.Destination.lat || 'N/A'}, ${driverInfo.Destination.lng || 'N/A'}`;
                              }
                            } else {
                              driverText = 'Driver information not available';
                            }
                            
                            swal({
                              title: "Driver Details",
                              text: driverText,
                              icon: "info",
                              type: "info"
                            });
                          }}
                        >
                          Show Driver Details
                        </Button>
                        <Button
                          style={{ backgroundColor: '#4CAF50', color: 'white', marginLeft: '10px' }}
                          onClick={this.showRoute}
                        >
                          Show Path
                        </Button>
                      </div>
                    )}
                    <br />
                    <Button
                      style={{ backgroundColor: '#f44336', color: 'white', marginLeft: '10px' }}
                      onClick={() => { this.resetFields(); this.clearRoute(); }}
                    >
                      Cancel
                    </Button>
                    
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Typography variant="body2">Distance: {this.state.distance}</Typography>
                      <Typography variant="body2">Duration: {this.state.duration}</Typography>
                    </Box>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {this.state.userData && (
                      <Card style={{ textAlign: 'left', padding: '5px' }}>
                        <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
                        <Typography variant="caption" style={{ 
                          color: this.state.websocketConnected ? '#4CAF50' : '#f44336',
                          fontSize: '10px'
                        }}>
                          {this.state.websocketConnected ? '🟢 Real-time' : '🔴 Offline'}
                        </Typography>
                      </Card>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      <Button
                        className="button_style"
                        variant="contained"
                        style={{ backgroundColor: '#4CAF50', color: 'white', marginRight: '10px' }}
                        size="small"
                        onClick={() => this.props.navigate("/history")}
                      >
                        History
                      </Button>
                      <Button
                        className="button_style"
                        variant="contained"
                        size="small"
                        style={{ backgroundColor: 'red', color: 'white' }}
                        onClick={this.logOut}
                      >
                        Log Out
                      </Button>
                    </div>
                  </div>
                  <Box display="flex" flexDirection="column" mb={2}>
                    <div>
                      <h3>New Ride</h3>
                      <Autocomplete
                        onLoad={(autocomplete) => (this.originRef.current = autocomplete)}
                        onPlaceChanged={() => {
                          const place = this.originRef.current.getPlace();
                          this.setState({ source: place.formatted_address });
                        }}
                      >
                        <Input
                          id="standard-basic"
                          type="text"
                          autoComplete="off"
                          name="source"
                          value={this.state.source}
                          onChange={this.onChange}
                          placeholder="Source"
                          required
                          fullWidth
                          InputProps={{ style: textFieldStyle }}
                        />
                      </Autocomplete><br />
                      <Autocomplete
                        onLoad={(autocomplete) => (this.destinationRef.current = autocomplete)}
                        onPlaceChanged={() => {
                          const place = this.destinationRef.current.getPlace();
                          this.setState({ destination: place.formatted_address });
                        }}
                      >
                        <Input
                          id="standard-basic"
                          type="text"
                          autoComplete="off"
                          name="destination"
                          value={this.state.destination}
                          onChange={this.onChange}
                          placeholder="Destination"
                          required
                          fullWidth
                          InputProps={{ style: textFieldStyle }}
                        />
                      </Autocomplete><br />
                      <FormControl component="fieldset">
                        <RadioGroup
                          name="role"
                          value={this.state.role}
                          onChange={this.onChange}
                          style={{ display: 'flex', flexDirection: 'row' }}
                        >
                          <FormControlLabel value="driver" control={<Radio />} label="Driver" />
                          <FormControlLabel value="rider" control={<Radio />} label="Rider" />
                        </RadioGroup>
                      </FormControl><br />
                      <Input
                        id="standard-basic"
                        type="number"
                        autoComplete="off"
                        name="seats"
                        value={this.state.seats}
                        onChange={this.onChange}
                        placeholder="Seats"
                        required
                        fullWidth
                        InputProps={{ style: textFieldStyle }}
                        disabled={this.state.role === 'rider'}
                      /><br />
                      <Input
                        id="standard-basic"
                        type="number"
                        autoComplete="off"
                        name="threshold"
                        value={this.state.threshold}
                        onChange={this.onChange}
                        placeholder="Deviation (in %)"
                        required
                        fullWidth
                        InputProps={{ style: textFieldStyle }}
                        disabled={this.state.role === 'rider'}
                      /><br /><br />
                      <Button
                        disabled={this.state.loading || this.state.source === '' || this.state.destination === '' || this.state.role === '' || (this.state.role === 'driver' && (this.state.seats === '' || this.state.threshold === ''))}
                        onClick={this.addRideRequest} 
                        style={{ backgroundColor: this.state.loading ? '#ccc' : '#4CAF50', color: 'white' }}
                      >
                        {this.state.loading ? 'Submitting...' : 'Submit'}
                      </Button>
                      <Button
                        style={{ backgroundColor: '#37474F', color: 'white', marginLeft: '10px' }}
                        onClick={this.fetchLatestRide}
                        disabled={this.state.loading}
                      >
                        {this.state.loading ? 'Loading...' : 'Get Ride'}
                      </Button>
                      <Button onClick={this.calculateRoute} color="primary" variant="contained" style={{ backgroundColor: '#6495ed', color: 'white', marginLeft: '10px' }}>
                        Route
                      </Button>
                      <Button
                        onClick={() => { this.resetFields(); this.clearRoute(); }} style={{ backgroundColor: '#f44336', color: 'white', marginLeft: '10px' }} >
                        Reset
                      </Button>
                      
                      <Box display="flex" justifyContent="space-between" mt={2}>
                        <Typography variant="body2">Distance: {this.state.distance}</Typography>
                        <Typography variant="body2">Duration: {this.state.duration}</Typography>
                      </Box>
                    </div>
                  </Box >
                </div>
              ))}
            </>
          )}
        </Box>
        <IconButton
          style={{ position: 'absolute', bottom: 40, right: 40, backgroundColor: 'white' }}
          onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const currentLocation = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                };
                this.setState({ center: currentLocation });
                this.state.map.panTo(currentLocation);
              },
              () => {
                swal({
                  text: 'Error fetching your location',
                  icon: "error",
                  type: "error",
                });
              }
            );
          }}
        >
          <FaLocationArrow />
        </IconButton>

        </Box>
      </LoadScript>
    );
  }
}

export default withRouter(Dashboard);
