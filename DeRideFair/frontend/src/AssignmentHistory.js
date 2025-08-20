import React, { Component } from 'react';
import {
    Button, LinearProgress,
    TableBody, Table,
    TableContainer, TableHead, TableRow, TableCell,
    Card, Dialog, DialogTitle, DialogContent, DialogActions,
    Typography, Pagination
} from '@mui/material';
import swal from 'sweetalert';
import { VscAccount } from "react-icons/vsc";
import { BiSolidCoinStack } from "react-icons/bi";
import { withRouter } from './utils';
import axios from 'axios';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2000';

class AssignmentHistory extends Component {
    constructor() {
        super();
        this.state = {
            token: '',
            page: 1,
            loading: false,
            userData: null,
            rideHistory: [],
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
            this.fetchRideHistory(token);
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

    fetchRideHistory = async (token) => {
        this.setState({ loading: true });
        
        try {
            // First get user data to determine role
            const userResponse = await axios.get(`${API_BASE_URL}/GetUser`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'content-type': 'application/json'
                }
            });
            
            // eslint-disable-next-line no-unused-vars
            const userData = userResponse.data.result;
            
            // Get both driver and rider history for complete view
            let allRides = [];
            
            try {
                const driverResponse = await axios.get(`${API_BASE_URL}/driver-history`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'content-type': 'application/json'
                    }
                });
                allRides = [...allRides, ...(driverResponse.data.rides || [])];
            } catch (err) {
                console.log('No driver history found');
            }
            
            try {
                const riderResponse = await axios.get(`${API_BASE_URL}/rider-history`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'content-type': 'application/json'
                    }
                });
                allRides = [...allRides, ...(riderResponse.data.rides || [])];
            } catch (err) {
                console.log('No rider history found');
            }
            
            // Sort by date descending
            const sortedRides = allRides.sort((a, b) => new Date(b.Date) - new Date(a.Date));
            this.setState({ rideHistory: sortedRides, loading: false });
            
        } catch (err) {
            this.setState({ loading: false });
            console.error('Failed to fetch ride history:', err);
            const errorMessage = err.response?.data?.errorMessage || "Failed to fetch ride history";
            swal({
                text: errorMessage,
                icon: "error",
                type: "error"
            });
        }
    }

    logOut = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('dashboardState');
        this.props.navigate("/");
    }

    handleDialogOpen = (data) => {
        this.setState({ dialogOpen: true, dialogData: data });
    }

    handleDialogClose = () => {
        this.setState({ dialogOpen: false, dialogData: null });
    }

    getPaginatedData = () => {
        const { page, rideHistory } = this.state;
        const startIndex = (page - 1) * 5;
        const endIndex = startIndex + 5;
        return rideHistory.slice(startIndex, endIndex);
    }
    
    render() {
        return (
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {this.state.loading && <LinearProgress size={40} />}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>Ride History</h2>
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
                            style={{ backgroundColor: '#4CAF50', color: 'white', marginRight: '10px' }}
                            onClick={() => this.props.navigate("/dashboard")}
                        >
                            Dashboard
                        </Button>
                        <Button
                            className="button_style"
                            variant="contained"
                            size="small"
                            style={{ backgroundColor: '#FF9800', color: 'white', marginRight: '10px' }}
                            onClick={() => this.props.navigate("/history")}
                        >
                            Ride History
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

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'row' }}>
                        
                        {/* Ride History */}
                        <div style={{ flex: 1 }}>
                            <Card style={{ padding: '15px' }}>
                                <Typography variant="h6" style={{ marginBottom: '15px' }}>My Ride History ({this.state.rideHistory.length} rides)</Typography>
                                <TableContainer>
                                    <Table aria-label="ride history table">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell align="center"><strong>Date</strong></TableCell>
                                                <TableCell align="center"><strong>Role</strong></TableCell>
                                                <TableCell align="center"><strong>Status</strong></TableCell>
                                                <TableCell align="center"><strong>Details</strong></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {this.getPaginatedData().map((ride, index) => (
                                                <TableRow key={index}>
                                                    <TableCell align="center">
                                                        {new Date(ride.Date).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell align="center" style={{ textTransform: 'capitalize' }}>{ride.Role}</TableCell>
                                                    <TableCell align="center">
                                                        <span style={{ 
                                                            color: 'green',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            Completed
                                                        </span>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Button
                                                            variant="contained"
                                                            size="small"
                                                            style={{ backgroundColor: '#37474F', color: 'white' }}
                                                            onClick={() => this.handleDialogOpen(ride)}
                                                        >
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <Pagination
                                        count={Math.ceil(this.state.rideHistory.length / 5)}
                                        page={this.state.page}
                                        onChange={(event, value) => this.setState({ page: value })}
                                        color="primary"
                                        style={{ marginTop: '15px' }}
                                    />
                                </TableContainer>
                            </Card>
                        </div>
                    </div>
                </div>

                {/* Details Dialog */}
                <Dialog open={this.state.dialogOpen} onClose={this.handleDialogClose} maxWidth="md" fullWidth>
                    <DialogTitle>Ride Details</DialogTitle>
                    <DialogContent>
                        {this.state.dialogData && (
                            <div style={{ fontSize: '14px' }}>
                                <p><strong>Date:</strong> {new Date(this.state.dialogData.Date).toLocaleString()}</p>
                                <p><strong>Time:</strong> {this.state.dialogData.Time}</p>
                                <p><strong>Role:</strong> {this.state.dialogData.Role}</p>
                                <p><strong>Source:</strong> {this.state.dialogData.Source ? `(${this.state.dialogData.Source.lat}, ${this.state.dialogData.Source.lng})` : 'N/A'}</p>
                                <p><strong>Destination:</strong> {this.state.dialogData.Destination ? `(${this.state.dialogData.Destination.lat}, ${this.state.dialogData.Destination.lng})` : 'N/A'}</p>
                                {this.state.dialogData.Role === 'driver' && (
                                    <>
                                        <p><strong>Riders:</strong> {this.state.dialogData.Riders ? this.state.dialogData.Riders.length : 0}</p>
                                        {this.state.dialogData.Riders && this.state.dialogData.Riders.length > 0 && (
                                            <div>
                                                <p><strong>Rider Details:</strong></p>
                                                {this.state.dialogData.Riders.map((rider, index) => (
                                                    <div key={index} style={{ marginLeft: '20px', marginBottom: '10px' }}>
                                                        <p>• Rider: {rider.riderId || rider.user}</p>
                                                        <p>  Source: ({rider.Source?.lat || 'N/A'}, {rider.Source?.lng || 'N/A'})</p>
                                                        <p>  Destination: ({rider.Destination?.lat || 'N/A'}, {rider.Destination?.lng || 'N/A'})</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                                {this.state.dialogData.Role === 'rider' && this.state.dialogData.Driver && (
                                    <p><strong>Driver:</strong> {this.state.dialogData.Driver}</p>
                                )}
                            </div>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.handleDialogClose} color="primary">
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        );
    }
}

export default withRouter(AssignmentHistory);
