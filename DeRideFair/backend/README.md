# DeRideFair Backend API

## Overview
This backend provides REST API endpoints for the DeRideFair ride-sharing system, integrating with the Hyperledger Fabric blockchain network.

## Updated for DeRideFair Chaincode v2.0
The backend has been completely updated to work with the new modular DeRideFair chaincode implementation. 

### 🎯 **Key Feature: Automatic N-User Assignment**
The system now automatically triggers ride assignments when configurable user thresholds are met:
- **Minimum total users**: Configurable (default: 2)
- **Minimum available drivers**: Configurable (default: 1) 
- **Minimum available riders**: Configurable (default: 1)

The assignment algorithm executes automatically whenever these conditions are satisfied after a user update.

### Key Updates Made:
- **Contract Reference**: Now uses `rideSharing` contract instead of `basic`
- **Function Signatures**: Updated to match new chaincode API
- **Enhanced Error Handling**: Better retry logic and user feedback
- **New Endpoints**: Added health check, assignment history, and algorithm endpoints
- **Environment Variables**: Full support for .env configuration
- **Automatic Algorithm Execution**: Triggers DeRideFair algorithm automatically when thresholds are met

## Prerequisites

1. **Hyperledger Fabric Network** - Running test network
2. **MongoDB** - For off-chain data storage
3. **Node.js** - Version 14 or higher
4. **DeRideFair Chaincode** - Deployed to the network

## Installation

```bash
cd DeRideFair/backend
npm install
```

## Configuration

### Environment Variables
Create a `.env` file based on `.env.example`:

```bash
# Assignment trigger configuration
MIN_USERS_FOR_ASSIGNMENT=2      # Minimum total users to trigger assignment
MIN_DRIVERS_REQUIRED=1           # Minimum available drivers required
MIN_RIDERS_REQUIRED=1            # Minimum available riders required

# Authentication
JWT_SECRET="your_jwt_secret"     # Optional, defaults to 'shhhhh11111'

# Database
MONGODB_URI="mongodb://localhost/productDB"

# Server
SERVER_PORT=2000
```

### Automatic Assignment Behavior
The system monitors user counts and automatically executes the DeRideFair algorithm when:
1. **Total users** ≥ `MIN_USERS_FOR_ASSIGNMENT`
2. **Available drivers** ≥ `MIN_DRIVERS_REQUIRED` (drivers with seats > 0 and not assigned)
3. **Available riders** ≥ `MIN_RIDERS_REQUIRED` (riders not assigned)

Assignment is triggered after any user update that satisfies these conditions.

### Hyperledger Fabric Configuration
Update the connection profile path in `server.js`:
```javascript
const CCP_PATH = '/path/to/your/connection-org1.json';
```

### MongoDB Connection
Ensure MongoDB is running on the default port (27017) or update the connection string:
```javascript
mongoose.connect("mongodb://localhost/productDB");
```

## Running the Server

```bash
npm start
# or
node server.js
```

The server will start on port 2000.

## API Endpoints

### Authentication Endpoints

#### POST /register
Register a new user and create blockchain identity.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "status": true,
  "message": "Successfully registered user..."
}
```

#### POST /login
Authenticate user and get JWT token.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "status": true,
  "token": "jwt_token",
  "message": "Login Successfully."
}
```

### User Management Endpoints

#### POST /update-user
Update user details and trigger ride assignment.

**Request:**
```json
{
  "source": {"lat": 40.7128, "lng": -74.0060},
  "destination": {"lat": 40.7589, "lng": -73.9851},
  "role": "Driver", // or "Rider"
  "seats": 4,      // Required for drivers
  "threshold": 20  // Required for drivers
}
```

**Response:**
```json
{
  "status": true,
  "title": "Ride details updated! Processing assignment..."
}
```

#### GET /GetUser
Get current user's blockchain data.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "result": {
    "ID": "username",
    "Source": {"lat": 40.7128, "lng": -74.0060},
    "Destination": {"lat": 40.7589, "lng": -73.9851},
    "Role": "Driver",
    "Seats": 4,
    "Assigned": false,
    // ... other user data
  }
}
```

#### GET /GetAllUsers
Get all users in the system.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "result": [
    // Array of user objects
  ]
}
```

### Algorithm Endpoints

#### GET /assignment-config
Get current assignment configuration and system status.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "config": {
    "minUsersForAssignment": 2,
    "minDriversRequired": 1,
    "minRidersRequired": 1
  },
  "currentStatus": {
    "isReady": true,
    "conditions": {
      "totalUsers": 5,
      "totalDrivers": 2,
      "totalRiders": 3,
      "availableDrivers": 2,
      "availableRiders": 3
    },
    "message": "Assignment conditions met: 5 users (2 drivers, 3 riders available)"
  }
}
```

#### POST /trigger-assignment
Manually trigger ride assignment.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "forceAssignment": false  // Set to true to override conditions
}
```

**Response:**
```json
{
  "status": true,
  "message": "Assignment completed successfully",
  "result": {
    // Full algorithm results
  },
  "conditionsCheck": {
    // Current system status
  }
}
```

#### GET /calculate-eligibility-matrix
Calculate the eligibility matrix for current users.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "message": "Eligibility matrix calculated successfully",
  "result": {
    "transactionId": "string",
    "statistics": {
      "totalDrivers": 5,
      "totalRiders": 10,
      "eligiblePairs": 25
    },
    // ... matrix data
  }
}
```

#### POST /execute-deride-fair
Execute the DeRideFair algorithm for ride assignments.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "message": "DeRideFair algorithm executed successfully",
  "result": {
    "transactionId": "string",
    "summary": {
      "totalRidersAssigned": 8,
      "driversWithAssignments": 3,
      "assignmentEfficiency": "80%"
    },
    "assignments": [
      // Assignment details
    ],
    // ... complete results
  }
}
```

### History and Monitoring

#### GET /assignment-history/:userId?
Get assignment history for a user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "userId": "username",
  "history": [
    // Historical assignment records
  ]
}
```

#### GET /history-rides
Get ride history from MongoDB.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "rides": [
    // MongoDB ride records
  ]
}
```

#### POST /update-database
Save current blockchain state to MongoDB.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "message": "Ride info updated successfully!"
}
```

#### GET /health
Check blockchain and backend health.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "status": true,
  "health": {
    "chaincode": "DeRideFair",
    "version": "2.0.0",
    "status": "healthy",
    "modules": {
      "algorithm": "loaded",
      "routeCalculator": "loaded",
      // ... other modules
    }
  }
}
```

## Testing

### Automatic Assignment Testing
Run the multi-user test to see automatic assignment in action:

```bash
./test_multi_user.sh
```

This script:
1. Creates multiple drivers and riders
2. Shows how assignment triggers automatically when thresholds are met
3. Demonstrates the N-user threshold functionality
4. Tests manual assignment triggers

### Basic Integration Test
Run the basic integration test:

```bash
./test_integration.sh
```

This script tests all major endpoints and functionality.

### Testing N-User Threshold Behavior

1. **Set custom thresholds:**
```bash
export MIN_USERS_FOR_ASSIGNMENT=3
export MIN_DRIVERS_REQUIRED=2
export MIN_RIDERS_REQUIRED=2
npm start
```

2. **Create users gradually and watch logs:**
```bash
# The backend will show assignment status after each user update
# Assignment only triggers when ALL conditions are met
```

3. **Check current status:**
```bash
curl -X GET http://localhost:2000/assignment-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Force assignment regardless of conditions:**
```bash
curl -X POST http://localhost:2000/trigger-assignment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"forceAssignment": true}'
```

### Manual Testing with cURL

1. **Register a user:**
```bash
curl -X POST http://localhost:2000/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

2. **Login:**
```bash
curl -X POST http://localhost:2000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

3. **Update user as driver:**
```bash
curl -X POST http://localhost:2000/update-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "source": {"lat": 40.7128, "lng": -74.0060},
    "destination": {"lat": 40.7589, "lng": -73.9851},
    "role": "Driver",
    "seats": 4,
    "threshold": 20
  }'
```

## Error Handling

The API returns standardized error responses:

```json
{
  "status": false,
  "errorMessage": "Description of the error"
}
```

Common error scenarios:
- Missing or invalid JWT token (401)
- Invalid request parameters (400)
- Blockchain network issues (500)
- User not found or unauthorized (400/401)

## Architecture

### Data Flow
1. **Frontend** → **Backend API** → **Hyperledger Fabric Network**
2. **Backend** processes blockchain responses
3. **MongoDB** stores processed ride information
4. **Automatic algorithm execution** for ride assignments

### Key Features
- JWT-based authentication
- Automatic retry mechanisms for blockchain transactions
- Real-time ride assignment processing
- Comprehensive error handling and logging
- Integration with Hyperledger Fabric and MongoDB

## Security

- JWT tokens for API authentication
- Hyperledger Fabric identity management
- Input validation and sanitization
- CORS protection
- bcrypt password hashing

## Performance Considerations

- Connection pooling for database operations
- Automatic retry logic for network issues
- Asynchronous processing for algorithm execution
- Efficient JSON serialization/deserialization

## Troubleshooting

### Common Issues

1. **"User unauthorized" errors**
   - Check JWT token validity
   - Ensure user exists in Fabric wallet

2. **Blockchain network errors**
   - Verify Fabric network is running
   - Check connection profile path
   - Ensure chaincode is deployed

3. **Algorithm execution fails**
   - Verify sufficient users (drivers and riders) exist
   - Check chaincode logs for detailed errors

4. **MongoDB connection issues**
   - Ensure MongoDB is running
   - Check connection string configuration

### Debug Mode
Enable debug logging by setting environment variable:
```bash
export DEBUG=*
npm start
```

## Dependencies

- **fabric-network**: Hyperledger Fabric client
- **fabric-ca-client**: Certificate Authority client
- **express**: Web framework
- **mongoose**: MongoDB ODM
- **jsonwebtoken**: JWT implementation
- **bcrypt**: Password hashing
- **cors**: Cross-origin resource sharing

## Version History

- **v1.0**: Initial implementation with basic chaincode
- **v2.0**: Updated for modular DeRideFair chaincode with enhanced features

## Support

For issues and questions:
1. Check the [BACKEND_UPDATES.md](./BACKEND_UPDATES.md) for recent changes
2. Review chaincode implementation for compatibility
3. Check Hyperledger Fabric network status
4. Verify MongoDB connectivity
