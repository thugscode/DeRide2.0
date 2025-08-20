import React, { Component, createRef } from 'react';
import {Box, IconButton, Input, Typography,
  Card, Button, RadioGroup, FormControlLabel, Radio, FormControl, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from '@material-ui/core';
import swal from 'sweetalert';
import { withRouter } from './utils';
import { VscAccount } from "react-icons/vsc";
import { BiSolidCoinStack } from "react-icons/bi";
import { FaLocationArrow, FaWindowMaximize, FaWindowMinimize } from 'react-icons/fa';
import { GoogleMap, Marker, Autocomplete, DirectionsRenderer } from '@react-google-maps/api';
import axios from 'axios';

const center = {
  lat: 22.3146362,
  lng: 87.2995949
};

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
      radius: '',
      loading: false,
      center: center,
      formSubmitted: false,
      userData: null,
      timer: 0,
      timerRunning: false,
      fetchedData: null,
      showCountdown: false,
      databaseUpdated: true, // Flag to track database update
      isLoaded: false,
      map: null,
      DriverPath: false,
      directionsResponse: null,
      distance: '',
      duration: '',
    };
    this.timerInterval = null;
    this.originRef = createRef();
    this.destinationRef = createRef();
  }

  componentDidMount = () => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => this.setState({ isLoaded: true });
    document.body.appendChild(script);

    let token = sessionStorage.getItem('token');
    if (!token) {
      this.props.navigate("/login");
    } else {
      this.setState({ token: token });
      axios.defaults.headers['Authorization'] = `Bearer ${token}`;
      this.fetchUserData(token);
    }

    const savedState = sessionStorage.getItem('dashboardState');
    if (savedState) {
      const parsedState = JSON.parse(savedState);
      if (parsedState.token === token) {
        this.setState(parsedState, () => {
          if (this.state.timerRunning) {
            this.startTimer();
          }
        });
      }
    }
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
    if (
      !this.state.fetchedData ||
      !this.state.fetchedData.Path ||
      this.state.fetchedData.Path.length < 2
    ) {
      swal({
        text: 'Invalid path data',
        icon: "error",
        type: "error",
      });
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    const results = await directionsService.route({
      origin: this.state.fetchedData.Path[0],
      destination: this.state.fetchedData.Path[this.state.fetchedData.Path.length - 1],
      travelMode: window.google.maps.TravelMode.DRIVING,
    });

    this.setState({
      DriverPath: true,
      directionsResponse: results,
      distance: results.routes[0].legs[0].distance.text,
      duration: results.routes[0].legs[0].duration.text,
    });
  };

  fetchUserData = (token) => {
    axios.get('http://localhost:2000/GetUser', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'content-type': 'application/json'
      }
    }).then((res) => {
      this.setState({ userData: res.data.result });
    }).catch((error) => {
      console.error(error);
      swal({
        text: error.response.data.errorMessage,
        icon: "error",
        type: "error"
      });
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
      radius: this.state.radius,
      formSubmitted: this.state.formSubmitted,
      timerRunning: this.state.timerRunning,
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
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  logOut = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('dashboardState');
    this.setState({
      token: '',
      source: '',
      destination: '',
      role: '',
      seats: '',
      threshold: '',
      radius: '',
      loading: false,
      center: center,
      formSubmitted: false,
      userData: null,
      timer: 0,
      timerRunning: false,
      fetchedData: null
    });
    this.props.navigate("/");
  }

  onChange = (e) => {
    const { name, value } = e.target;
    if (name === 'role') {
      if (value === 'driver') {
        this.setState({ role: value, radius: '0' });
      } else if (value === 'rider') {
        this.setState({ role: value, seats: '0', threshold: '0' });
      }
    } else {
      this.setState({ [name]: value });
    }
  };

  addRideRequest = async (e) => {
    e.preventDefault();

    const { source, destination, role, seats, threshold, radius, userData } = this.state;
    if (!source || !destination || !role || (role === 'driver' && (!seats || !threshold)) || (role === 'rider' && !radius)) {
      swal({
        text: 'Please fill out all required fields.',
        icon: "warning",
        type: "warning",
      });
      return;
    }

    if (userData && userData.Token === 0) {
      swal({
        text: "Please provide a ride first.",
        icon: "warning",
        type: "warning",
      });
      return;
    }

    try {

      const sourceCoords = await this.geocodeAddress(source);
      const destinationCoords = await this.geocodeAddress(destination);
      const userDataPayload = {
        source:sourceCoords,
        destination:destinationCoords,
        role,
        seats,
        threshold,
        radius,
      };
  
      axios.post('http://localhost:2000/update-user', userDataPayload, {
        headers: {
          'Authorization': `Bearer ${this.state.token}`,
        }
      }).then((res) => {
        swal({
          text: res.data.title,
          icon: "success",
          type: "success",
        });
  
        this.setState({ formSubmitted: true, showCountdown: true, databaseUpdated: false, fetchedData: res.data.result });
        this.startTimer();
      }).catch((err) => {
        swal({
          text: err.response.data.errorMessage,
          icon: "error",
          type: "error",
        });
      });
      
    } catch (error) {
      console.error(error);
      swal({
        text: error.response.data.errorMessage,
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
          resolve(location);
        } else {
          reject(new Error('Geocode was not successful for the following reason: ' + status));
        }
      });
    });
  };

  stopTimer = () => {
    this.setState({ timerRunning: false, showCountdown: false });
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  resetFields = () => {
    this.setState({
      source: '',
      destination: '',
      role: '',
      seats: '',
      threshold: '',
      radius: '',
      formSubmitted: false,
      timer: 0,
      timerRunning: false,
      fetchedData: null,
      showCountdown: false
    });
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startTimer = () => {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.setState({ timerRunning: true });
    this.timerInterval = setInterval(() => {
      this.setState((prevState) => {
        const newTimer = prevState.timer + 1;
        if (newTimer === 180) {
          this.stopTimer();
          swal({
            text: 'Fetching the latest ride information...',
            icon: "info",
            type: "info",
          });
          this.fetchLatestRide();
        }
        return { timer: newTimer };
      });
    }, 1000);
  };

  fetchLatestRide = () => {
    axios.get('http://localhost:2000/GetUser', {
      headers: {
        'Authorization': `Bearer ${this.state.token}`,
        'content-type': 'application/json'
      }
    }).then((res) => {
      const fetchedData = res.data.result;
      this.getAddress(fetchedData.Source, 'source');
      this.getAddress(fetchedData.Destination, 'destination');
      if (!fetchedData.Assigned) {
        swal({
          text: 'No Ride is available for you',
          icon: "error",
          type: "error",
        });
        return;
      }

      // Use a local variable to prevent multiple updates
      if (!this.state.databaseUpdated) {
        this.setState({ 
          fetchedData: fetchedData, 
          showCountdown: false, 
          formSubmitted: false, 
          databaseUpdated: true 
        });
        this.updateDatabase(fetchedData); // Update database here
      } else {
        this.setState({
          fetchedData: fetchedData,
          showCountdown: false,
          formSubmitted: false
        });
      }
    }).catch((err) => {
      swal({
        text: err.response.data.errorMessage,
        icon: "error",
        type: "error",
      });
    });
  };
  

  updateDatabase = (data) => {
    if (!data) {
      swal({
        text: 'No data available to update the database',
        icon: "error",
        type: "error",
      });
      return;
    }

    axios.post('http://localhost:2000/update-database', data, {
      headers: {
        'Authorization': `Bearer ${this.state.token}`,
      }
    }).then(() => {
      swal({
        text: 'Hurray! You have been assigned a ride',
        icon: "success",
        type: "success",
      });
    }).catch((err) => {
      swal({
        text: 'Error updating the database',
        icon: "error",
        type: "error",
      });
    });
  };

  render() {
    if (!this.state.isLoaded) {
      return <CircularProgress />;
    }

    const textFieldStyle = {
      fontSize: '20px',
      padding: '10px'
    };

    return (
      <Box
        position="relative"
        display="flex"
        flexDirection="column"
        alignItems="center"
        height="98vh"
        width="99vw"
      >
        <Box position="absolute" left={0} top={0} height="100%" width="100%">
          {this.state.isLoaded && (
            <GoogleMap
              zoom={16}
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
              {this.state.fetchedData && this.state.DriverPath && this.state.fetchedData.Riders && this.state.fetchedData.Riders.map((rider, index) => (
                <React.Fragment key={index}>
                  <Marker
                    position={{
                      lat: rider[Object.keys(rider)[0]].Source.lat,
                      lng: rider[Object.keys(rider)[0]].Source.lng
                    }}
                    icon={{
                      url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    }}
                  />
                  <Marker
                    position={{
                      lat: rider[Object.keys(rider)[0]].Destination.lat,
                      lng: rider[Object.keys(rider)[0]].Destination.lng
                    }}
                    icon={{
                      url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    }}
                  />
                </React.Fragment>
              ))}
            </GoogleMap>
          )}
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
              {this.state.formSubmitted ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {this.state.userData && (
                      <Card style={{ textAlign: 'left' }}>
                        <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
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
                    {this.state.role === 'rider' && (
                      <p>Radius: {this.state.radius}</p>
                    )}
                    {this.state.showCountdown && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px 0', position: 'relative' }}>
                        <CircularProgress size={80} style={{ color: '#4CAF50' }} />
                        <span style={{ position: 'absolute' }}> {Math.floor((180 - this.state.timer) / 60)}:{(180 - this.state.timer) % 60}</span>
                      </div>
                    )}
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
                      <Card style={{ textAlign: 'left' }}>
                        <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
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
                          onClick={() => swal({
                            title: "Driver Details",
                            text: `Driver ID: ${this.state.fetchedData.Driver.ID}\nSource: ${this.state.fetchedData.Driver.Source.lat}, ${this.state.fetchedData.Driver.Source.lng}\nDestination: ${this.state.fetchedData.Driver.Destination.lat}, ${this.state.fetchedData.Driver.Destination.lng}`,
                            icon: "info",
                            type: "info"
                          })}
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
                      <Card style={{ textAlign: 'left' }}>
                        <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
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
                      /><br />
                      <Input
                        id="standard-basic"
                        type="number"
                        autoComplete="off"
                        name="radius"
                        value={this.state.radius}
                        onChange={this.onChange}
                        placeholder="Radius"
                        required
                        fullWidth
                        InputProps={{ style: textFieldStyle }}
                        disabled={this.state.role === 'driver'}
                      /><br /><br />
                      <Button
                        disabled={this.state.source === '' || this.state.destination === '' || this.state.role === '' || this.state.seats === '' || this.state.threshold === '' || this.state.radius === ''}
                        onClick={this.addRideRequest} style={{ backgroundColor: '#4CAF50', color: 'white' }} >
                        Submit
                      </Button>
                      <Button
                        style={{ backgroundColor: '#37474F', color: 'white', marginLeft: '10px' }}
                        onClick={this.fetchLatestRide}
                      >
                        Get Ride
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
    );
  }
}

export default withRouter(Dashboard);