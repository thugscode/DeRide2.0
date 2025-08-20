import React, { Component } from 'react';
import {
    Button, LinearProgress,
    TableBody, Table,
    TableContainer, TableHead, TableRow, TableCell,
    Card, Dialog, DialogTitle, DialogContent, DialogActions, Typography
} from '@material-ui/core';
import { Pagination } from '@material-ui/lab';
import swal from 'sweetalert';
import { VscAccount } from "react-icons/vsc";
import { BiSolidCoinStack } from "react-icons/bi";
import { withRouter } from './utils';

const axios = require('axios');
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2000';

class History extends Component {
    constructor() {
        super();
        this.state = {
            token: '',
            page: 1,
            loading: false,
            userData: null,
            ridesData: [],
            dialogOpen: false,
            dialogData: null
        };
    }

    componentDidMount = () => {
        let token = sessionStorage.getItem('token');
        if (!token) {
            this.props.navigate("/login");
        } else {
            this.setState({ token: token });
            // Set authorization header for all axios requests
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            this.fetchUserData(token);
            this.fetchRidesData(token);
        }
    }

    fetchUserData = (token) => {
        axios.get(`${API_BASE_URL}/GetUser`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'content-type': 'application/json'
            }
        }).then((res) => {
            this.setState({ userData: res.data.result });
        }).catch((err) => {
            console.error('Failed to fetch user data:', err);
            const errorMessage = err.response?.data?.errorMessage || "Failed to load user data";
            swal({
                text: errorMessage,
                icon: "error",
                type: "error"
            });
        });
    }

    getAddressFromCoords = (coords) => {
        if (!coords || !coords.lat || !coords.lng) {
            return 'Location unavailable';
        }
        return `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }

    fetchRidesData = async (token) => {
        this.setState({ loading: true });
        
        try {
            // First get user data to determine role
            const userResponse = await axios.get(`${API_BASE_URL}/GetUser`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'content-type': 'application/json'
                }
            });
            
            const userData = userResponse.data.result;
            const userRole = userData.Role;
            
            console.log('Current user data:', userData);
            console.log('User role:', userRole);
            
            let allRides = [];
            
            // Try both APIs but filter results based on actual user participation
            // This ensures users only see rides where they were actually involved
            try {
                const driverResponse = await axios.get(`${API_BASE_URL}/driver-history`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'content-type': 'application/json'
                    }
                });
                console.log('Driver history response:', driverResponse.data);
                if (driverResponse.data.status && Array.isArray(driverResponse.data.rides)) {
                    // Only include rides where user was actually the driver
                    const driverRides = driverResponse.data.rides
                        .filter(ride => ride.Role === 'driver')
                        .map(ride => ({
                            ...ride,
                            fetchedAs: 'driver'
                        }));
                    allRides = [...allRides, ...driverRides];
                }
            } catch (err) {
                console.log('Driver history error:', err.response?.data || err.message);
            }
            
            try {
                const riderResponse = await axios.get(`${API_BASE_URL}/rider-history`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'content-type': 'application/json'
                    }
                });
                console.log('Rider history response:', riderResponse.data);
                if (riderResponse.data.status && Array.isArray(riderResponse.data.rides)) {
                    // Only include rides where user was actually the rider
                    const riderRides = riderResponse.data.rides
                        .filter(ride => ride.Role === 'rider')
                        .map(ride => ({
                            ...ride,
                            fetchedAs: 'rider'
                        }));
                    allRides = [...allRides, ...riderRides];
                }
            } catch (err) {
                console.log('Rider history error:', err.response?.data || err.message);
            }
            
            console.log('All fetched rides before deduplication:', allRides);
            console.log('Total rides before deduplication:', allRides.length);
            
            // Sort by date descending and remove any duplicates based on unique ride identifiers
            const uniqueRides = allRides.filter((ride, index, self) => {
                return index === self.findIndex(r => {
                    // Use _id for reliable duplicate detection (should be unique per ride-role combination)
                    if (ride._id && r._id) {
                        return r._id === ride._id;
                    }
                    // Fallback to comparing multiple fields including role
                    return (
                        r.Date === ride.Date && 
                        r.Time === ride.Time && 
                        r.Role === ride.Role &&
                        r.Source?.lat === ride.Source?.lat &&
                        r.Source?.lng === ride.Source?.lng &&
                        r.Destination?.lat === ride.Destination?.lat &&
                        r.Destination?.lng === ride.Destination?.lng
                    );
                });
            });
            
            console.log('Unique rides after deduplication:', uniqueRides);
            console.log('Total rides after deduplication:', uniqueRides.length);
            
            if (uniqueRides.length === 0) {
                swal({
                    text: 'No ride history found. Complete some rides to see them here.',
                    icon: "info",
                    type: "info"
                });
            }
            
            const sortedRides = uniqueRides.sort((a, b) => new Date(b.Date) - new Date(a.Date));
            this.setState({ ridesData: sortedRides, loading: false });
            
        } catch (err) {
            this.setState({ loading: false });
            console.error('Failed to fetch rides data:', err);
            const errorMessage = err.response?.data?.errorMessage || "Failed to load ride history";
            
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
                    type: "error"
                });
            }
        }
    }

    logOut = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('dashboardState');
        this.props.navigate("/");
    }

    handleDialogOpen = (data, ride) => {
        console.log('Dialog data received:', { data, ride }); // Debug log
        let formattedData;
    
        if (ride.Role === 'driver' && data) {
            // Driver viewing their riders - handle both array and non-array cases
            if (Array.isArray(data)) {
                formattedData = data.map((item) => ({
                    user: item.riderId || item.user || item,
                    source: item.Source,
                    destination: item.Destination,
                    showLocation: !!(item.Source && item.Destination)
                }));
            } else {
                // Handle case where data might be a single rider or string
                formattedData = [{
                    user: typeof data === 'string' ? data : (data.riderId || data.user || data),
                    source: data.Source,
                    destination: data.Destination,
                    showLocation: !!(data.Source && data.Destination)
                }];
            }
        } else if (ride.Role === 'rider') {
            // Rider viewing their driver - only show driver ID
            formattedData = {
                user: typeof data === 'string' ? data : (data?.ID || data?.user || data || 'Unknown Driver'),
                showLocation: false
            };
        } else {
            // Fallback for other cases
            formattedData = { user: data || 'No data available', showLocation: false };
        }
    
        console.log('Formatted data:', formattedData); // Debug log
        this.setState({ dialogOpen: true, dialogData: formattedData });
    };
    

    handleDialogClose = () => {
        this.setState({ dialogOpen: false, dialogData: null });
    }

    getPaginatedData = () => {
        const { page, ridesData } = this.state;
        const startIndex = (page - 1) * 7;
        const endIndex = startIndex + 7;
        return ridesData.slice(startIndex, endIndex);
    }
    
    render() {
        return (
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {this.state.loading && <LinearProgress size={40} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>History</h2>
                {this.state.userData && (
                <Card style={{ textAlign: 'left', padding: '5px' }}>
                 <h3><VscAccount /> : {this.state.userData.ID} | <BiSolidCoinStack /> : {this.state.userData.Token}</h3>
                </Card>
                )}
                <div>
                <Button
                    className="button_style"
                    variant="contained"
                    size="small"
                    style={{ backgroundColor: '#4CAF50', color: 'white' }}
                    onClick={() => this.props.navigate("/dashboard")}
                >
                    Book a Ride
                </Button>
                <Button
                    className="button_style"
                    variant="contained"
                    size="small"
                    style={{ backgroundColor: 'red', color: 'white', marginRight: '10px' }}
                    onClick={this.logOut}
                >
                    Log Out
                </Button>
                </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
                                        <div style={{ flex: 1 }}>
                            <Card style={{ padding: '15px' }}>
                                <Typography variant="h6" style={{ marginBottom: '15px' }}>
                                    Ride History ({this.state.ridesData.length} rides)
                                </Typography>
                                {this.state.ridesData.length === 0 && !this.state.loading && (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <Typography variant="body1" color="textSecondary">
                                            No ride history found.
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary" style={{ marginTop: '10px' }}>
                                            Complete some rides to see them here. Make sure to:
                                        </Typography>
                                        <ul style={{ textAlign: 'left', marginTop: '10px' }}>
                                            <li>Submit your ride request</li>
                                            <li>Wait for assignment</li>
                                            <li>Click "Save to History" when assigned</li>
                                        </ul>
                                    </div>
                                )}
                                {this.state.ridesData.length > 0 && (
                                    <TableContainer>
                                        <Table aria-label="simple table">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell align="center"><strong>Date</strong></TableCell>
                                                    <TableCell align="center"><strong>Time</strong></TableCell>
                                                    <TableCell align="center"><strong>Role</strong></TableCell>
                                                    <TableCell align="center"><strong>Source</strong></TableCell>
                                                    <TableCell align="center"><strong>Destination</strong></TableCell>
                                                    <TableCell align="center"><strong>Driver/Rider</strong></TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {this.getPaginatedData().map((ride, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell align="center">{new Date(ride.Date).toLocaleDateString()}</TableCell>
                                                        <TableCell align="center">{ride.Time}</TableCell>
                                                        <TableCell align="center" style={{ textTransform: 'capitalize' }}>{ride.Role}</TableCell>
                                                        <TableCell align="center">
                                                            {ride.Source && typeof ride.Source === 'object' 
                                                                ? `(${ride.Source.lat}, ${ride.Source.lng})` 
                                                                : (ride.Source || 'N/A')}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {ride.Destination && typeof ride.Destination === 'object' 
                                                                ? `(${ride.Destination.lat}, ${ride.Destination.lng})` 
                                                                : (ride.Destination || 'N/A')}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                style={{ backgroundColor: '#37474F', color: 'white' }}
                                                                onClick={() => {
                                                                    console.log('Button clicked for ride:', ride);
                                                                    console.log('Data to pass:', ride.Role === 'driver' ? ride.Riders : ride.Driver);
                                                                    this.handleDialogOpen(ride.Role === 'driver' ? ride.Riders : ride.Driver, ride);
                                                                }}
                                                            >
                                                                {ride.Role === 'driver' ? 'Riders' : 'Driver'}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        <br />
                                        <br />
                                        <Pagination
                                            count={Math.ceil(this.state.ridesData.length / 7)}
                                            page={this.state.page}
                                            onChange={(event, value) => this.setState({ page: value })}
                                            color="primary"
                                        />
                                    </TableContainer>
                                )}
                            </Card>
                        </div>
                </div>
            </div>
            <Dialog open={this.state.dialogOpen} onClose={this.handleDialogClose}>
                <DialogTitle>
                    {Array.isArray(this.state.dialogData) ? 'Riders Details' : 'Driver Details'}
                </DialogTitle>
                <DialogContent>
                    <div style={{ minWidth: '300px', padding: '10px' }}>
                        {Array.isArray(this.state.dialogData) ? (
                            // Driver viewing riders - same clean style as rider view
                            this.state.dialogData.length > 0 ? (
                                this.state.dialogData.map((item, index) => (
                                    <div key={index} style={{ marginBottom: '15px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                                            <strong>Rider ID:</strong> {item.user}
                                        </div>
                                        {item.showLocation && item.source && item.destination && (
                                            <div style={{ fontSize: '14px', color: '#666' }}>
                                                <div style={{ marginBottom: '4px' }}>
                                                    <strong>Source:</strong> {item.source.lat}, {item.source.lng}
                                                </div>
                                                <div>
                                                    <strong>Destination:</strong> {item.destination.lat}, {item.destination.lng}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                    No riders found for this ride.
                                </div>
                            )
                        ) : (
                            // Rider viewing driver - keep same clean style
                            this.state.dialogData && this.state.dialogData.user ? (
                                <div style={{ padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                                        <strong>Driver ID:</strong> {this.state.dialogData.user}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                    No data available
                                </div>
                            )
                        )}
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={this.handleDialogClose} color="primary" variant="contained">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
            </div>
        );
    }
}

export default withRouter(History);
