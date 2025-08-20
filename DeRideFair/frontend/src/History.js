import React, { useState, useEffect } from 'react';
import {
    Button, 
    Table,
    TableBody,
    TableContainer, 
    TableHead, 
    TableRow, 
    TableCell,
    Card,
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions,
    Paper
} from '@mui/material';
import { Pagination } from '@mui/lab';
import { VscAccount } from 'react-icons/vsc';
import { BiSolidCoinStack } from 'react-icons/bi';
import swal from 'sweetalert';
import { withRouter } from './utils';
import axios from 'axios';

const History = ({ navigate }) => {
    const [state, setState] = useState({
        token: '',
        page: 1,
        loading: false,
        userData: null,
        ridesData: [],
        dialogOpen: false,
        dialogData: null,
        error: null
    });

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate("/login");
        } else {
            setState(prev => ({ ...prev, token }));
            fetchUserData(token);
            fetchRidesData(token);
        }
    }, [navigate]);

    const fetchUserData = async (token) => {
        try {
            const response = await axios.get('http://localhost:2000/GetUser', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            setState(prev => ({ ...prev, userData: response.data.result }));
        } catch (err) {
            console.error('Failed to fetch user data:', err);
            const errorMessage = err.response?.data?.errorMessage || "Failed to load user data";
            swal({
                text: errorMessage,
                icon: "error",
                type: "error"
            });
        }
    };

    const fetchRidesData = async (token) => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        try {
            const response = await axios.get('http://localhost:2000/history', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.data.status && response.data.rides) {
                const sortedRides = response.data.rides.sort((a, b) => new Date(b.Date) - new Date(a.Date));
                setState(prev => ({ 
                    ...prev, 
                    ridesData: sortedRides, 
                    loading: false 
                }));
            } else {
                setState(prev => ({ 
                    ...prev, 
                    ridesData: [], 
                    loading: false 
                }));
                swal({
                    text: "No ride history found",
                    icon: "info",
                    type: "info"
                });
            }
        } catch (err) {
            setState(prev => ({ 
                ...prev, 
                loading: false, 
                error: err.response?.data?.errorMessage || "Failed to fetch ride history"
            }));
            
            const errorMessage = err.response?.data?.errorMessage || "Failed to fetch ride history";
            swal({
                text: errorMessage,
                icon: "error",
                type: "error"
            });
        }
    };

    const handleLogOut = () => {
        sessionStorage.removeItem('token');
        navigate("/");
    };

    const handleDialogOpen = (data) => {
        let formattedData;
    
        if (Array.isArray(data)) {
            // Handle Riders data
            formattedData = data.map((item) => ({
                user: item.riderId || item.user,
                source: item.Source,
                destination: item.Destination,
            }));
        } else if (typeof data === "string") {
            try {
                // Handle Driver data (parse string)
                const parsedData = JSON.parse(data);
                formattedData = {
                    user: parsedData.ID,
                    source: parsedData.Source,
                    destination: parsedData.Destination,
                };
            } catch (e) {
                console.error("Failed to parse data", e);
                formattedData = { user: data };
            }
        } else {
            formattedData = { user: data };
        }
    
        setState(prev => ({ 
            ...prev, 
            dialogOpen: true, 
            dialogData: formattedData 
        }));
    };

    const handleDialogClose = () => {
        setState(prev => ({ 
            ...prev, 
            dialogOpen: false, 
            dialogData: null 
        }));
    };

    const getPaginatedData = () => {
        const { page, ridesData } = state;
        const itemsPerPage = 10; // Increased from 7 to 10 for better full screen usage
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return ridesData.slice(startIndex, endIndex);
    };

    const handlePageChange = (event, value) => {
        setState(prev => ({ ...prev, page: value }));
    };

    const getPageCount = () => {
        const itemsPerPage = 10;
        return Math.ceil(state.ridesData.length / itemsPerPage);
    };

    const formatLocation = (location) => {
        if (location && typeof location === 'object') {
            return `${location.lat?.toFixed(4) || 0}, ${location.lng?.toFixed(4) || 0}`;
        }
        return 'N/A';
    };

    return (
        <div style={{
            height: '98vh',
            width: '98vw',
            backgroundColor: 'white',
            padding: '20px',
            boxSizing: 'border-box',
            overflow: 'auto'
        }}>
            {/* Main content */}
            <div style={{
                width: '100%',
                height: '100%'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3>Ride History</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {state.userData && (
                            <Card style={{ textAlign: 'left', padding: '5px' }}>
                                <h3><VscAccount /> : {state.userData.ID} | <BiSolidCoinStack /> : {state.userData.Token}</h3>
                            </Card>
                        )}
                        <Button
                            className="button_style"
                            variant="contained"
                            style={{ backgroundColor: '#4CAF50', color: 'white', marginRight: '10px' }}
                            size="small"
                            onClick={() => navigate("/dashboard")}
                        >
                            Dashboard
                        </Button>
                        <Button
                            className="button_style"
                            variant="contained"
                            size="small"
                            style={{ backgroundColor: 'red', color: 'white' }}
                            onClick={handleLogOut}
                        >
                            Log Out
                        </Button>
                    </div>
                </div>

                {/* Loading indicator */}
                {state.loading && (
                    <div style={{ textAlign: 'center', margin: '20px 0' }}>
                        <p>Loading ride history...</p>
                    </div>
                )}

                {/* Error message */}
                {state.error && (
                    <div style={{ 
                        backgroundColor: '#ffebee', 
                        color: '#c62828', 
                        padding: '10px', 
                        borderRadius: '5px', 
                        marginBottom: '20px',
                        border: '1px solid #ef5350'
                    }}>
                        {state.error}
                    </div>
                )}

                {/* Main content */}
                {!state.loading && state.ridesData.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <h3>No ride history found</h3>
                        <p>Complete some rides to see them here</p>
                    </div>
                ) : (
                    <div>
                        <TableContainer component={Paper} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            <Table>
                                <TableHead>
                                    <TableRow style={{ backgroundColor: '#f5f5f5' }}>
                                        <TableCell align="center" style={{ fontWeight: 'bold' }}>Date</TableCell>
                                        <TableCell align="center" style={{ fontWeight: 'bold' }}>Time</TableCell>
                                        <TableCell align="center" style={{ fontWeight: 'bold' }}>Role</TableCell>
                                        <TableCell align="center" style={{ fontWeight: 'bold' }}>Source</TableCell>
                                        <TableCell align="center" style={{ fontWeight: 'bold' }}>Destination</TableCell>
                                        <TableCell align="center" style={{ fontWeight: 'bold' }}>Details</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {getPaginatedData().map((ride, index) => (
                                        <TableRow 
                                            key={ride._id || index}
                                            style={{ 
                                                backgroundColor: index % 2 === 0 ? 'white' : '#f9f9f9'
                                            }}
                                        >
                                            <TableCell align="center">
                                                {new Date(ride.Date).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell align="center">
                                                {ride.Time}
                                            </TableCell>
                                            <TableCell align="center">
                                                <span style={{
                                                    backgroundColor: ride.Role === 'driver' ? '#e3f2fd' : '#fce4ec',
                                                    color: ride.Role === 'driver' ? '#1976d2' : '#c2185b',
                                                    padding: '4px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {ride.Role}
                                                </span>
                                            </TableCell>
                                            <TableCell align="center">
                                                {formatLocation(ride.Source)}
                                            </TableCell>
                                            <TableCell align="center">
                                                {formatLocation(ride.Destination)}
                                            </TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    style={{ backgroundColor: '#4CAF50', color: 'white' }}
                                                    onClick={() => handleDialogOpen(ride.Role === 'driver' ? ride.Riders : ride.Driver)}
                                                >
                                                    {ride.Role === 'driver' ? 'Riders' : 'Driver'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Enhanced Pagination */}
                        {state.ridesData.length > 0 && getPageCount() > 1 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginTop: '30px',
                                padding: '20px',
                                backgroundColor: '#f9f9f9',
                                borderRadius: '10px',
                                border: '1px solid #e0e0e0'
                            }}>
                                {/* Results info */}
                                <div style={{ color: '#666', fontSize: '14px' }}>
                                    Showing {((state.page - 1) * 10) + 1} to {Math.min(state.page * 10, state.ridesData.length)} of {state.ridesData.length} rides
                                </div>
                                
                                {/* Pagination controls */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    {/* First page button */}
                                    <Button
                                        disabled={state.page === 1}
                                        onClick={() => handlePageChange(null, 1)}
                                        size="small"
                                        style={{ 
                                            backgroundColor: state.page === 1 ? '#ccc' : '#4CAF50', 
                                            color: 'white',
                                            minWidth: '35px',
                                            fontSize: '12px'
                                        }}
                                    >
                                        First
                                    </Button>
                                    
                                    {/* Previous button */}
                                    <Button
                                        disabled={state.page === 1}
                                        onClick={() => handlePageChange(null, state.page - 1)}
                                        size="small"
                                        style={{ 
                                            backgroundColor: state.page === 1 ? '#ccc' : '#4CAF50', 
                                            color: 'white',
                                            minWidth: '35px',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Prev
                                    </Button>
                                    
                                    {/* MUI Pagination component */}
                                    <Pagination
                                        count={getPageCount()}
                                        page={state.page}
                                        onChange={handlePageChange}
                                        color="primary"
                                        size="small"
                                        showFirstButton={false}
                                        showLastButton={false}
                                        siblingCount={1}
                                        boundaryCount={1}
                                        sx={{
                                            '& .MuiPaginationItem-root': {
                                                backgroundColor: 'white',
                                                border: '1px solid #ddd',
                                                '&:hover': {
                                                    backgroundColor: '#4CAF50',
                                                    color: 'white'
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: '#ee5324',
                                                    color: 'white',
                                                    '&:hover': {
                                                        backgroundColor: '#d84315'
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                    
                                    {/* Next button */}
                                    <Button
                                        disabled={state.page >= getPageCount()}
                                        onClick={() => handlePageChange(null, state.page + 1)}
                                        size="small"
                                        style={{ 
                                            backgroundColor: state.page >= getPageCount() ? '#ccc' : '#4CAF50',
                                            color: 'white',
                                            minWidth: '35px',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Next
                                    </Button>
                                    
                                    {/* Last page button */}
                                    <Button
                                        disabled={state.page >= getPageCount()}
                                        onClick={() => handlePageChange(null, getPageCount())}
                                        size="small"
                                        style={{ 
                                            backgroundColor: state.page >= getPageCount() ? '#ccc' : '#4CAF50',
                                            color: 'white',
                                            minWidth: '35px',
                                            fontSize: '12px'
                                        }}
                                    >
                                        Last
                                    </Button>
                                </div>
                                
                                {/* Page jump input */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ color: '#666', fontSize: '14px' }}>Go to page:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={getPageCount()}
                                        value={state.page}
                                        onChange={(e) => {
                                            const newPage = parseInt(e.target.value);
                                            if (newPage >= 1 && newPage <= getPageCount()) {
                                                handlePageChange(null, newPage);
                                            }
                                        }}
                                        style={{
                                            width: '60px',
                                            padding: '5px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            textAlign: 'center'
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Details Dialog */}
            <Dialog 
                open={state.dialogOpen} 
                onClose={handleDialogClose}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    style: { borderRadius: '10px' }
                }}
            >
                <DialogTitle style={{ backgroundColor: '#f5f5f5', textAlign: 'center' }}>
                    <h3>{Array.isArray(state.dialogData) ? 'Riders Details' : 'Driver Details'}</h3>
                </DialogTitle>
                <DialogContent style={{ padding: '20px' }}>
                    <div style={{ marginTop: '10px' }}>
                        {Array.isArray(state.dialogData) ? (
                            // Multiple Riders
                            state.dialogData.length > 0 ? (
                                state.dialogData.map((item, index) => (
                                    <div key={index} style={{ 
                                        border: '1px solid #ddd', 
                                        borderRadius: '5px', 
                                        padding: '15px', 
                                        marginBottom: '15px',
                                        backgroundColor: '#fafafa'
                                    }}>
                                        <h4 style={{ margin: '0 0 10px 0', color: '#ee5324' }}>
                                            Rider: {item.user}
                                        </h4>
                                        {item.source && item.destination && (
                                            <div style={{ marginLeft: '10px' }}>
                                                <p style={{ margin: '5px 0' }}>
                                                    <strong>Source:</strong> {formatLocation(item.source)}
                                                </p>
                                                <p style={{ margin: '5px 0' }}>
                                                    <strong>Destination:</strong> {formatLocation(item.destination)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div style={{ 
                                    backgroundColor: '#e1f5fe', 
                                    color: '#0277bd', 
                                    padding: '15px', 
                                    borderRadius: '5px',
                                    textAlign: 'center'
                                }}>
                                    No riders found for this ride.
                                </div>
                            )
                        ) : (
                            // Single Driver
                            state.dialogData && state.dialogData.user ? (
                                <div style={{ 
                                    border: '1px solid #ddd', 
                                    borderRadius: '5px', 
                                    padding: '15px',
                                    backgroundColor: '#fafafa'
                                }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#ee5324' }}>
                                        Driver: {state.dialogData.user}
                                    </h4>
                                    {state.dialogData.source && state.dialogData.destination && (
                                        <div style={{ marginLeft: '10px' }}>
                                            <p style={{ margin: '5px 0' }}>
                                                <strong>Source:</strong> {formatLocation(state.dialogData.source)}
                                            </p>
                                            <p style={{ margin: '5px 0' }}>
                                                <strong>Destination:</strong> {formatLocation(state.dialogData.destination)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ 
                                    backgroundColor: '#fff3e0', 
                                    color: '#f57c00', 
                                    padding: '15px', 
                                    borderRadius: '5px',
                                    textAlign: 'center'
                                }}>
                                    No data available
                                </div>
                            )
                        )}
                    </div>
                </DialogContent>
                <DialogActions style={{ padding: '15px 20px' }}>
                    <Button 
                        onClick={handleDialogClose} 
                        variant="contained"
                        style={{ backgroundColor: '#4CAF50', color: 'white' }}
                        fullWidth
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default withRouter(History);
