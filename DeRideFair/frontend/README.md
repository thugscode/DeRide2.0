# DeRideFair Frontend

This is the frontend for the DeRideFair ride-sharing application with comprehensive backend integration.

## Features

### 1. User Authentication
- **Secure Login/Registration**: User authentication with JWT tokens
- **Hyperledger Fabric Integration**: Automatic blockchain user creation during registration

### 2. Dashboard
- **Ride Request Management**: Submit ride requests as driver or rider
- **Real-time Assignment**: Automatic assignment processing with 180-second timer
- **Interactive Maps**: Google Maps integration for route planning and visualization
- **Live Status Updates**: Real-time assignment status and ride information

### 3. Ride History Management
- **Personal History**: View your completed and pending rides
- **Assignment History**: Dedicated page for tracking ride activities
- **Detailed Information**: Complete ride details with source, destination, and assignment data

### 4. Backend Integration
- **Blockchain Connectivity**: Direct integration with Hyperledger Fabric network
- **Real-time Data**: Live synchronization between frontend, database, and blockchain
- **Route Optimization**: Google Maps API for optimal route calculation

### 5. Enhanced UI Components
- **Responsive Design**: Clean interface that works across all devices
- **Status Indicators**: Color-coded assignment status and ride information
- **Interactive Dialogs**: Detailed view modals for ride information
- **Progress Tracking**: Assignment countdown and status updates

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `REACT_APP_GOOGLE_MAPS_API_KEY`: Your Google Maps API key
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:2000)

## API Integration

The frontend now integrates with all backend endpoints:

## API Integration

The frontend integrates with all backend endpoints provided by server.js:

### Authentication & User Management
- `POST /login` - User authentication with JWT tokens
- `POST /register` - User registration with Hyperledger Fabric integration
- `GET /GetUser` - Current user data from blockchain

### Ride Management
- `POST /update-user` - Submit ride requests with automatic assignment processing
- `POST /update-database` - Save assignment results to MongoDB
- `GET /history-rides` - User's ride history from database

## Component Structure

```
src/
├── index.js                 # Main routing configuration
├── Login.js                 # User authentication
├── Register.js              # User registration
├── Dashboard.js             # Main dashboard with ride management
├── History.js               # User ride history
├── AssignmentHistory.js     # Alternative ride history view
├── utils.js                 # Router utilities
└── Login.css               # Styles
```

## Navigation Flow

```
Login → Dashboard ↔ Ride History
  ↓              ↓
Register ←→ Assignment History
```

## Usage Instructions

### For Users
1. **Register**: Create a new account (automatically creates blockchain identity)
2. **Login**: Authenticate with your credentials
3. **Submit Ride Request**: Use the Dashboard to submit ride details as driver or rider
4. **Wait for Assignment**: System automatically processes assignments with 180-second timer
5. **View Results**: Check assignment results and ride details
6. **Track History**: View your ride history in the History or Assignment History pages

## Key Features

1. **Seamless Integration**: Frontend perfectly synced with server.js endpoints
2. **Real-time Updates**: Live data synchronization with backend services
3. **Blockchain Integration**: Automatic Hyperledger Fabric user management
4. **Secure Authentication**: JWT-based authentication system
5. **Responsive Design**: Works across all devices and screen sizes

## Development Notes

- All API calls match exactly with server.js endpoints
- Error handling uses consistent `errorMessage` fields
- Environment variables configured for easy deployment
- Real-time data fetching with proper error handling
- Clean component architecture following React best practices

## Technical Stack

- **Frontend**: React.js with Material-UI components
- **Backend**: Node.js/Express.js (server.js)
- **Blockchain**: Hyperledger Fabric integration
- **Database**: MongoDB for ride history
- **Maps**: Google Maps API for route optimization
- **Authentication**: JWT tokens
