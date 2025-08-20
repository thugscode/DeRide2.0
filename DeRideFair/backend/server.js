'use strict';

// Load environment variables from .env file
require('dotenv').config();

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const express = require("express");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require("mongoose");
const fs = require('fs');
const RideInfo = require('./model/rideInfo.js');
const User = require("./model/user.js");
const axios = require('axios');
const WebSocket = require('ws');
const http = require('http');

/**
 * Finds the optimized route using Google Maps Directions API.
 * @param {Object} userData - The user data object containing Source, Destination, Role, Riders.
 * @returns {Promise<Array>} - Array of route points (lat/lng) representing the path.
 */
async function findOptimizedRoute(userData) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('Google Maps API key missing');

  // Helper to format lat/lng for API
  const formatLatLng = obj => `${obj.lat},${obj.lng}`;

  if (userData.Role === 'driver') {
    // Collect waypoints: all riders' sources and destinations
    let waypoints = [];
    if (userData.Riders && Array.isArray(userData.Riders)) {
      userData.Riders.forEach(rider => {
        if (rider.Source && rider.Destination) {
          waypoints.push(formatLatLng(rider.Source));
          waypoints.push(formatLatLng(rider.Destination));
        }
      });
    }
    // Remove duplicates
    waypoints = [...new Set(waypoints)];

    // Build Directions API request
    const params = {
      origin: formatLatLng(userData.Source),
      destination: formatLatLng(userData.Destination),
      waypoints: waypoints.join('|'),
      optimizeWaypoints: true,
      key: apiKey
    };
    const url = `https://maps.googleapis.com/maps/api/directions/json`;
    const response = await axios.get(url, { params });
    if (response.data.status !== 'OK') throw new Error('Google Maps API error: ' + response.data.status);
    // Extract path (lat/lng sequence)
    const route = response.data.routes[0];
    const path = [];
    route.legs.forEach(leg => {
      leg.steps.forEach(step => {
        path.push({ lat: step.start_location.lat, lng: step.start_location.lng });
        path.push({ lat: step.end_location.lat, lng: step.end_location.lng });
      });
    });
    return path;
  } else if (userData.Role === 'rider') {
    // Rider: path is just from source to destination
    const params = {
      origin: formatLatLng(userData.Source),
      destination: formatLatLng(userData.Destination),
      key: apiKey
    };
    const url = `https://maps.googleapis.com/maps/api/directions/json`;
    const response = await axios.get(url, { params });
    if (response.data.status !== 'OK') throw new Error('Google Maps API error: ' + response.data.status);
    const route = response.data.routes[0];
    const path = [];
    route.legs.forEach(leg => {
      leg.steps.forEach(step => {
        path.push({ lat: step.start_location.lat, lng: step.start_location.lng });
        path.push({ lat: step.end_location.lat, lng: step.end_location.lng });
      });
    });
    return path;
  } else {
    return [];
  }
}

/**
 * Send WebSocket notification to a specific user
 * @param {string} username - The username to notify
 * @param {Object} data - The data to send
 */
function notifyUser(username, data) {
  const userConnections = wsConnections.get(username) || [];
  userConnections.forEach((ws, index) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        console.log(`📡 Sent notification to ${username}:`, data.type);
      } else {
        // Remove dead connection
        userConnections.splice(index, 1);
      }
    } catch (error) {
      console.error(`❌ Failed to send notification to ${username}:`, error.message);
      // Remove dead connection
      userConnections.splice(index, 1);
    }
  });
  
  // Clean up empty arrays
  if (userConnections.length === 0) {
    wsConnections.delete(username);
  }
}

/**
 * Notify all users involved in a ride assignment
 * @param {Object} contract - The blockchain contract instance
 */
async function notifyRideAssignment(contract) {
  try {
    console.log('📢 Notifying all users about ride assignment...');
    
    // Get all users from blockchain to notify them
    const totalUsersResult = await contract.evaluateTransaction('GetNumberOfUsers');
    const totalUsers = parseInt(totalUsersResult.toString());
    
    // For now, we'll send a general notification
    // In a more sophisticated system, you'd get specific assignment details
    wsConnections.forEach((connections, username) => {
      notifyUser(username, {
        type: 'ASSIGNMENT_COMPLETED',
        message: 'Ride assignment has been completed! Please check your assigned ride.',
        timestamp: new Date().toISOString()
      });
    });
    
    console.log(`📡 Sent assignment notifications to ${wsConnections.size} connected users`);
  } catch (error) {
    console.error('❌ Error notifying ride assignment:', error.message);
  }
}

/**
 * Checks if assignment conditions are met and triggers assignment if needed
 * @param {Object} contract - The blockchain contract instance
 * @param {string} username - The username who triggered the update
 */
async function checkAndTriggerAssignment(contract, username) {
  try {
    // Get environment variables for thresholds
    const MIN_USERS_FOR_ASSIGNMENT = parseInt(process.env.MIN_USERS_FOR_ASSIGNMENT) || 2;

    console.log('🔍 Checking assignment conditions...');
    console.log(`Threshold: Users=${MIN_USERS_FOR_ASSIGNMENT}`);

    // Get total number of users from blockchain
    const totalUsersResult = await contract.evaluateTransaction('GetNumberOfUsers');
    const totalUsers = parseInt(totalUsersResult.toString());

    console.log(`📊 Current status: Total Users=${totalUsers}`);

    // Check if condition is met
    const conditionMet = totalUsers >= MIN_USERS_FOR_ASSIGNMENT;

    if (conditionMet) {
      console.log('✅ Assignment condition met! Triggering assignment process...');
      
      // Immediately notify all connected users that assignment is starting
      console.log('📢 Notifying all users that assignment is starting...');
      wsConnections.forEach((connections, user) => {
        notifyUser(user, {
          type: 'ASSIGNMENT_STARTING',
          message: 'Assignment process is starting! Please wait while rides are being assigned.',
          timestamp: new Date().toISOString()
        });
      });
      
      try {
        // Step 1: Calculate eligibility matrix
        console.log('🔢 Calculating eligibility matrix...');
        await contract.submitTransaction('MatrixCalculation');
        console.log('✅ MatrixCalculation completed successfully');

        // Wait 5 seconds before proceeding to assignment
        console.log('⏳ Waiting 5 seconds before executing assignment...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 2: Execute assignment algorithm (only if MatrixCalculation succeeded)
        console.log('🚗 Executing ride assignment...');
        await contract.submitTransaction('DoAssignment');
        console.log('✅ DoAssignment completed successfully');

        console.log('🎉 Automatic assignment process completed!');
        
        // Notify all users about completed assignment
        await notifyRideAssignment(contract);
        
        return true;
      } catch (assignmentError) {
        console.error('❌ Assignment process failed:', assignmentError.message);
        
        // Notify users about assignment failure
        wsConnections.forEach((connections, user) => {
          notifyUser(user, {
            type: 'ASSIGNMENT_FAILED',
            message: 'Assignment process encountered an error. Please try submitting your ride again.',
            timestamp: new Date().toISOString()
          });
        });
        
        // Check if it failed during MatrixCalculation or DoAssignment
        if (assignmentError.message.includes('MatrixCalculation')) {
          console.error('❌ Failed during MatrixCalculation phase');
        } else {
          console.error('❌ Failed during DoAssignment phase (MatrixCalculation may have succeeded)');
        }
        
        return false;
      }
    } else {
      console.log('⏳ Assignment condition not yet met:');
      console.log(`   - Total users: ${totalUsers}/${MIN_USERS_FOR_ASSIGNMENT} ${totalUsers >= MIN_USERS_FOR_ASSIGNMENT ? '✅' : '❌'}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking assignment conditions:', error.message);
    return false;
  }
}

// Database configuration from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/productDB";
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const app = express();
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Store WebSocket connections for each user
const wsConnections = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'shhhhh11111';
// Fabric configuration from environment variables
const CCP_PATH = process.env.FABRIC_CCP_PATH || '/home/shailesh/Hyperledger/fabric/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';
const WALLET_PATH = process.env.FABRIC_WALLET_PATH || path.join(process.cwd(), 'wallet');
const CHANNEL_NAME = process.env.FABRIC_CHANNEL_NAME || 'mychannel';
const CONTRACT_NAME = process.env.FABRIC_CONTRACT_NAME || 'rideSharing';

const loadNetworkConfig = () => JSON.parse(fs.readFileSync(CCP_PATH, 'utf8'));

const getWallet = async () => await Wallets.newFileSystemWallet(WALLET_PATH);

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ errorMessage: 'Token is missing!', status: false });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded?.user) {
      return res.status(401).json({ errorMessage: 'User unauthorized!', status: false });
    }
    req.user = decoded;
    next();
  });
};

app.use("/", (req, res, next) => {
  if (["/login", "/register", "/"].includes(req.path)) {
    return next();
  }
  
  // Use regular user verification for all other routes
  verifyToken(req, res, next);
});

app.get("/", (req, res) => {
  res.status(200).json({ status: true, title: 'Apis' });
});

const checkUserAndGenerateToken = (data, res) => {
  jwt.sign({ user: data.username, id: data._id }, JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
    if (err) {
      res.status(400).json({ status: false, errorMessage: err });
    } else {
      res.json({ message: 'Login Successfully.', token, status: true });
    }
  });
};

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ errorMessage: 'Add proper parameter first!', status: false });
    }

    // Trim username to match registration behavior
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return res.status(400).json({ errorMessage: 'Username cannot be empty!', status: false });
    }

    const user = await User.findOne({ username: trimmedUsername });
    
    // Check if user doesn't exist (not registered)
    if (!user) {
      return res.status(400).json({ errorMessage: 'Please do registration first', status: false });
    }
    
    // Check if password is incorrect
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(400).json({ errorMessage: 'Username or password is incorrect!', status: false });
    }
    
    // If user exists and password is correct, generate token
    checkUserAndGenerateToken(user, res);
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ errorMessage: 'Database error occurred!', status: false });
  }
});

app.post('/register', async (req, res) => {
  try {
    const { username, password} = req.body;

    if (!username || !password) {
      return res.status(400).json({ errorMessage: 'Fill user name and password first!', status: false });
    }

    // Trim and validate username
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      return res.status(400).json({ errorMessage: 'Username cannot be empty!', status: false });
    }

    // Check if user exists in MongoDB database
    const existingUser = await User.findOne({ username: trimmedUsername });
    if (existingUser) {
      return res.status(400).json({ 
        errorMessage: `User "${trimmedUsername}" is already registered. Please try login instead.`, 
        status: false
      });
    }

    // Check if user exists in wallet
    const ccp = loadNetworkConfig();
    const wallet = await getWallet();
    
    const userIdentity = await wallet.get(trimmedUsername);
    if (userIdentity) {
      return res.status(400).json({ 
        errorMessage: `User "${trimmedUsername}" already exists in the system. Please try login instead.`, 
        status: false
      });
    }

    // Check admin identity exists for blockchain operations
    const adminIdentity = await wallet.get('admin');
    if (!adminIdentity) {
      return res.status(400).json({ 
        errorMessage: 'Admin identity not found in wallet. Run the enrollAdmin.js application before retrying', 
        status: false 
      });
    }

    console.log(`✅ User "${trimmedUsername}" doesn't exist. Proceeding with registration...`);

    // Proceed with registration
    const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
    const ca = new FabricCAServices(caURL);

    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, 'admin');

    // Register and enroll user in Fabric CA
    const secret = await ca.register({ affiliaytion: 'org1.department1', enrollmentID: trimmedUsername, role: 'client' }, adminUser);
    const enrollment = await ca.enroll({ enrollmentID: trimmedUsername, enrollmentSecret: secret });

    const x509Identity = {
      credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() },
      mspId: 'Org1MSP',
      type: 'X.509',
    };

    // Store identity in wallet
    await wallet.put(trimmedUsername, x509Identity);
    console.log(`✅ User "${trimmedUsername}" identity stored in wallet`);

    // Save user in database
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = new User({ username: trimmedUsername, password: hashedPassword });
    await newUser.save();
    console.log(`✅ User "${trimmedUsername}" saved in database`);

    // Create user in blockchain
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: trimmedUsername });
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CONTRACT_NAME);

    await contract.submitTransaction('CreateUser', trimmedUsername.toString());
    console.log(`✅ User "${trimmedUsername}" created in blockchain`);
    gateway.disconnect();

    res.status(200).json({ 
      status: true, 
      message: `Successfully registered user "${trimmedUsername}". You can now login with your credentials.`
    });
  } catch (error) {
    console.error(`Failed to register user "${req.body.username}": ${error}`);
    
    // Handle specific duplicate key error from MongoDB
    if (error.code === 11000) {
      return res.status(400).json({ 
        errorMessage: `User "${req.body.username}" is already registered. Please try login instead.`, 
        status: false 
      });
    }
    
    // Handle Fabric CA enrollment errors (duplicate enrollment)
    if (error.message && error.message.includes('is already registered')) {
      return res.status(400).json({ 
        errorMessage: `User "${req.body.username}" is already registered in the system. Please try login instead.`, 
        status: false 
      });
    }
    
    res.status(500).json({ errorMessage: `Failed to register user "${req.body.username}": ${error.message}`, status: false });
  }
});

app.post("/update-user", async (req, res) => {
  console.log('🎯 === UPDATE USER REQUEST STARTED ===');
  try {
    const { source, destination, role, seats, threshold } = req.body;
    console.log('📝 Request body:', { source, destination, role, seats, threshold });

    if (!source || !destination || !role) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ errorMessage: 'Source, destination, and role are required!', status: false });
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ errorMessage: 'Token is missing!', status: false });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err || !decoded?.user) {
        console.log('❌ Token verification failed:', err?.message);
        return res.status(401).json({ errorMessage: 'User unauthorized!', status: false });
      }

      const username = decoded.user;
      console.log(`👤 Authenticated user: ${username}`);
      
      const ccp = loadNetworkConfig();
      const wallet = await getWallet();
      const identity = await wallet.get(username);
      if (!identity) {
        console.log(`❌ Identity not found for user: ${username}`);
        return res.status(400).json({ errorMessage: `The user "${username}" is logged out`, status: false });
      }

      console.log(`✅ Identity found for user: ${username}`);
      console.log('🔗 Connecting to blockchain network...');
      
      const gateway = new Gateway();
      await gateway.connect(ccp, { wallet, identity: username });

      const network = await gateway.getNetwork(CHANNEL_NAME);
      const contract = network.getContract(CONTRACT_NAME);
      console.log('✅ Connected to blockchain network');

      // Validate and parse parameters
      const parsedSeats = role === 'driver' ? parseInt(seats) || 0 : 0;
      const parsedThreshold = role === 'driver' ? parseInt(threshold) || 0 : 0;

      if (role === 'driver' && (parsedSeats <= 0 || parsedThreshold <= 0)) {
        console.log('❌ Invalid driver parameters:', { seats: parsedSeats, threshold: parsedThreshold });
        return res.status(400).json({ errorMessage: 'Driver must have valid seats (>0) and threshold (>0)!', status: false });
      }

      let updateSuccess = false;
      let updateAttempts = 0;
      const maxUpdateAttempts = 5;

      console.log('📊 Updating user with:', {
        username,
        source,
        destination,
        role,
        seats: parsedSeats,
        threshold: parsedThreshold
      });

      while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
        try {
          console.log(`🔄 Update attempt ${updateAttempts + 1}/${maxUpdateAttempts}`);
          
          await contract.submitTransaction(
            'UpdateUser', 
            username, 
            JSON.stringify(source), 
            JSON.stringify(destination), 
            role,
            parsedSeats.toString(),
            parsedThreshold.toString()
          );
          updateSuccess = true;
          console.log('✅ UpdateUser transaction submitted successfully');
        } catch (error) {
          updateAttempts++;
          console.error(`❌ Update attempt ${updateAttempts} failed:`, error.message);
          if (updateAttempts >= maxUpdateAttempts) {
            gateway.disconnect();
            console.log('❌ Max update attempts reached, giving up');
            return res.status(500).json({ errorMessage: 'Failed! Please submit your ride details again.', status: false });
          }
          console.log(`⏳ Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('🔍 Starting assignment condition check...');
      // After successful user update, check if assignment conditions are met
      let assignmentTriggered = false;
      try {
        assignmentTriggered = await checkAndTriggerAssignment(contract, username);
        console.log(`📋 Assignment check result: ${assignmentTriggered ? 'TRIGGERED' : 'NOT_TRIGGERED'}`);
        
        // If assignment was triggered, immediately notify the triggering user
        if (assignmentTriggered) {
          console.log(`📡 Sending immediate assignment notification to ${username}`);
          notifyUser(username, {
            type: 'ASSIGNMENT_TRIGGERED',
            message: 'Your ride submission has triggered the assignment process! Please wait while rides are being assigned.',
            timestamp: new Date().toISOString()
          });
        }
      } catch (assignmentError) {
        console.error('❌ Assignment check failed:', assignmentError.message);
        // Don't fail the user update if assignment check fails
      }

      gateway.disconnect();
      console.log('🔌 Disconnected from blockchain network');

      // Include assignment status in response
      const responseMessage = assignmentTriggered 
        ? 'Ride details updated successfully! Assignment process has been triggered automatically.' 
        : 'Ride details updated successfully!';

      console.log(`✅ UPDATE USER REQUEST COMPLETED: ${responseMessage}`);
      console.log('🎯 === UPDATE USER REQUEST ENDED ===\n');

      res.status(200).json({ 
        status: true, 
        title: responseMessage,
        assignmentTriggered: assignmentTriggered
      });

    });
  } catch (e) {
    console.error('💥 Update user error:', e);
    console.log('🎯 === UPDATE USER REQUEST FAILED ===\n');
    res.status(400).json({ errorMessage: 'Something went wrong!', status: false });
  }
});

app.post("/update-database", async (req, res) => {
  console.log('💾 === UPDATE DATABASE REQUEST STARTED ===');
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ errorMessage: 'Token is missing!', status: false });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err || !decoded?.user) {
        console.log('❌ Token verification failed:', err?.message);
        return res.status(401).json({ errorMessage: 'User unauthorized!', status: false });
      }

      const username = decoded.user;
      console.log(`👤 Authenticated user: ${username}`);
      
      const ccp = loadNetworkConfig();
      const wallet = await getWallet();
      const identity = await wallet.get(username);
      if (!identity) {
        console.log(`❌ Identity not found for user: ${username}`);
        return res.status(400).json({ errorMessage: `The user "${username}" is logged out`, status: false });
      }

      console.log(`✅ Identity found for user: ${username}`);
      console.log('🔗 Connecting to blockchain network...');

      const gateway = new Gateway();
      await gateway.connect(ccp, { wallet, identity: username });

      const network = await gateway.getNetwork(CHANNEL_NAME);
      const contract = network.getContract(CONTRACT_NAME);
      console.log('✅ Connected to blockchain network');

      console.log('📖 Reading user data from blockchain...');
      let result;
      let userData;
      try {
        result = await contract.evaluateTransaction('ReadUser', username.toString());
        userData = JSON.parse(result.toString());
        
        // Validate essential userData fields
        if (!userData || !userData.ID || !userData.Role) {
          console.error('❌ Invalid user data from blockchain:', userData);
          return res.status(400).json({ 
            status: false, 
            errorMessage: 'Invalid user data received from blockchain. Please try updating your ride details again.' 
          });
        }
        
        console.log('📋 User data from blockchain:', {
          ID: userData.ID,
          Role: userData.Role,
          Assigned: userData.Assigned,
          Driver: userData.Driver,
          RidersCount: userData.Riders ? userData.Riders.length : 0
        });
      } catch (blockchainReadError) {
        console.error('❌ Failed to read user data from blockchain:', blockchainReadError.message);
        return res.status(500).json({ 
          status: false, 
          errorMessage: 'Failed to read user data from blockchain. Please try again.' 
        });
      }

      // Handle the new chaincode data structure
      let optimizedPath = [];
      try {
        console.log('🗺️ Finding optimized route...');
        optimizedPath = await findOptimizedRoute(userData);
        console.log(`✅ Route found with ${optimizedPath.length} points`);
      } catch (err) {
        console.error('❌ Error finding optimized route:', err.message);
        optimizedPath = [];
      }

      // Create the simplified data structure for saving to database
      const processedData = {
        ID: userData.ID,
        Source: userData.Source,
        Destination: userData.Destination,
        Role: userData.Role,
        Seats: userData.Seats,
        Threshold: userData.Threshold,
        Assigned: userData.Assigned,
        Driver: typeof userData.Driver === 'object' && userData.Driver.ID 
          ? userData.Driver.ID 
          : (typeof userData.Driver === 'string' && userData.Driver.trim() !== ''
            ? userData.Driver 
            : (userData.Role === 'driver' ? username : 'unassigned')),
        Riders: [],
        Path: optimizedPath
      };

      // Process riders data based on the role
      if (userData.Riders && Array.isArray(userData.Riders)) {
        console.log(`🧑‍🤝‍🧑 Processing ${userData.Riders.length} riders...`);
        processedData.Riders = userData.Riders.map(riderId => {
          if (typeof riderId === 'string') {
            return {
              user: riderId,
              Source: { lat: 0, lng: 0 },
              Destination: { lat: 0, lng: 0 }
            };
          } else if (typeof riderId === 'object') {
            const [user, details] = Object.entries(riderId)[0];
            return {
              user,
              Source: details.Source || { lat: 0, lng: 0 },
              Destination: details.Destination || { lat: 0, lng: 0 }
            };
          }
          return riderId;
        });
      }

      // Only save if Assigned is true and Driver is valid
      if (processedData.Assigned === true) {
        console.log('✅ User is assigned, proceeding to save...');
        
        if (!processedData.Driver || processedData.Driver.trim() === '') {
          console.error('❌ Driver field is empty, cannot save ride info');
          return res.status(400).json({ 
            status: false, 
            errorMessage: 'Invalid driver assignment. Please try updating your ride details again.' 
          });
        }

        // For drivers: validate that they have riders assigned before saving
        if (processedData.Role === 'driver') {
          if (!processedData.Riders || processedData.Riders.length === 0) {
            console.log('⚠️ Driver has no riders assigned yet, skipping save');
            return res.status(400).json({ 
              status: false, 
              errorMessage: 'Driver assignment incomplete - no riders assigned yet. Please wait for complete assignment.' 
            });
          }
          
          // Check if riders have valid data (not just empty objects)
          const validRiders = processedData.Riders.filter(rider => 
            rider && 
            rider.user && 
            rider.user.trim() !== '' &&
            rider.Source && 
            rider.Destination &&
            rider.Source.lat !== 0 && 
            rider.Source.lng !== 0 &&
            rider.Destination.lat !== 0 && 
            rider.Destination.lng !== 0
          );
          
          if (validRiders.length === 0) {
            console.log('⚠️ Driver has no valid riders with location data, skipping save');
            return res.status(400).json({ 
              status: false, 
              errorMessage: 'Driver assignment incomplete - riders do not have valid location data yet. Please wait for complete assignment.' 
            });
          }
          
          // Update processedData with only valid riders
          processedData.Riders = validRiders;
          console.log(`✅ Driver has ${validRiders.length} valid riders`);
        }

        console.log(`💾 Saving ride data for driver: ${processedData.Driver}`);

        // Check for true duplicates (same ride within the last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        console.log(`🔍 Checking for recent duplicates since: ${fiveMinutesAgo}`);

        // For drivers, also check that we don't have incomplete rides (rides without proper rider data)
        let recentDuplicate;
        if (processedData.Role === 'driver') {
          // Find recent duplicate that has valid rider data
          recentDuplicate = await RideInfo.findOne({
            Driver: processedData.Driver,
            'Source.lat': processedData.Source.lat,
            'Source.lng': processedData.Source.lng,
            'Destination.lat': processedData.Destination.lat,
            'Destination.lng': processedData.Destination.lng,
            Assigned: true,
            Date: { $gte: fiveMinutesAgo },
            'Riders.0': { $exists: true }, // Ensure it has at least one rider
            'Riders.user': { $ne: null, $ne: '' } // Ensure riders have valid user IDs
          });
        } else {
          // For riders, use the original logic
          recentDuplicate = await RideInfo.findOne({
            Driver: processedData.Driver,
            'Source.lat': processedData.Source.lat,
            'Source.lng': processedData.Source.lng,
            'Destination.lat': processedData.Destination.lat,
            'Destination.lng': processedData.Destination.lng,
            Assigned: true,
            Date: { $gte: fiveMinutesAgo }
          });
        }

        if (recentDuplicate) {
          console.log('📝 Recent duplicate found, updating instead of creating new...');
          
          // Update the existing recent ride with new data
          await RideInfo.updateOne(
            { _id: recentDuplicate._id },
            {
              ...processedData,
              Date: recentDuplicate.Date, // Keep original date
              Time: recentDuplicate.Time   // Keep original time
            }
          );
          
          // Fetch the updated ride info to return
          const updatedRide = await RideInfo.findById(recentDuplicate._id);

          console.log('✅ Updated recent duplicate ride successfully');
          
          // Notify user about successful database update
          notifyUser(username, {
            type: 'RIDE_UPDATED',
            message: 'Your ride information has been updated successfully!',
            timestamp: new Date().toISOString()
          });
          
          res.status(200).json({ status: true, message: 'Ride info updated successfully!', ride: updatedRide });
        } else {
          console.log('🆕 No recent complete duplicate found, creating new...');
          
          // Before creating new ride, clean up any incomplete rides for this driver
          if (processedData.Role === 'driver') {
            const deletedIncomplete = await RideInfo.deleteMany({
              Driver: processedData.Driver,
              $or: [
                { Riders: { $size: 0 } }, // No riders
                { 'Riders.user': { $in: [null, ''] } }, // Riders with empty user IDs
                { 'Riders.Source.lat': 0 }, // Riders with invalid coordinates
                { 'Riders.Source.lng': 0 },
                { 'Riders.Destination.lat': 0 },
                { 'Riders.Destination.lng': 0 }
              ]
            });
            
            if (deletedIncomplete.deletedCount > 0) {
              console.log(`🧹 Cleaned up ${deletedIncomplete.deletedCount} incomplete rides for driver ${processedData.Driver}`);
            }
          }

          // Create new ride record without cleaning up previous rides
          // This allows users to maintain their complete ride history
          const newRideInfo = new RideInfo({
            ...processedData,
            Date: new Date(),
            Time: new Date().toLocaleTimeString()
          });

          await newRideInfo.save();
          console.log('✅ New ride info saved successfully');
          
          // Notify user about successful database save
          notifyUser(username, {
            type: 'RIDE_SAVED',
            message: 'Your ride has been saved to history successfully!',
            timestamp: new Date().toISOString()
          });
          
          res.status(200).json({ status: true, message: 'Ride info saved successfully!', ride: newRideInfo });
        }
      } else {
        console.log('⏳ User not assigned yet, skipping database save');
        res.status(400).json({ status: false, errorMessage: 'Ride not assigned yet. Please wait for assignment.' });
      }

      gateway.disconnect();
      console.log('🔌 Disconnected from blockchain network');
      console.log('💾 === UPDATE DATABASE REQUEST COMPLETED ===\n');
    });
  } catch (error) {
    console.error('💥 Update database error:', error);
    console.log('💾 === UPDATE DATABASE REQUEST FAILED ===\n');
    res.status(500).json({ errorMessage: `Failed to update in database ${error}`, status: false });
  }
});

app.get('/history', async (req, res) => {
  console.log('� === RIDE HISTORY REQUEST STARTED ===');
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ errorMessage: 'Token is missing!', status: false });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err || !decoded?.user) {
        return res.status(401).json({ errorMessage: 'User unauthorized!', status: false });
      }

      const username = decoded.user;
      const rides = await RideInfo.find({ ID: username });
      res.status(200).json({ status: true, rides });
    });
  } catch (error) {
    res.status(500).json({ errorMessage: `Failed to fetch history rides: ${error}`, status: false });
  }
});


app.get('/GetUser', async (req, res) => {
  console.log('👤 === GET USER REQUEST STARTED ===');
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ errorMessage: 'Token is missing!', status: false });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err || !decoded?.user) {
        console.log('❌ Token verification failed:', err?.message);
        return res.status(401).json({ errorMessage: 'User unauthorized!', status: false });
      }

      const username = decoded.user;
      console.log(`👤 Getting user data for: ${username}`);
      
      const ccp = loadNetworkConfig();
      const wallet = await getWallet();
      const identity = await wallet.get(username);
      if (!identity) {
        console.log(`❌ Identity not found for user: ${username}`);
        return res.status(400).json({ errorMessage: `The user "${username}" is logged out`, status: false });
      }

      console.log(`✅ Identity found for user: ${username}`);
      console.log('🔗 Connecting to blockchain network...');

      const gateway = new Gateway();
      await gateway.connect(ccp, { wallet, identity: username });

      const network = await gateway.getNetwork(CHANNEL_NAME);
      const contract = network.getContract(CONTRACT_NAME);
      console.log('✅ Connected to blockchain network');

      try {
        console.log('📖 Reading user data from blockchain...');
        const result = await contract.evaluateTransaction('ReadUser', username);
        const userData = JSON.parse(result.toString());
        
        console.log('📋 User data retrieved:', {
          ID: userData.ID,
          Role: userData.Role,
          Assigned: userData.Assigned,
          HasSource: !!(userData.Source),
          HasDestination: !!(userData.Destination),
          RidersCount: userData.Riders ? userData.Riders.length : 0
        });
        
        gateway.disconnect();
        console.log('🔌 Disconnected from blockchain network');
        console.log('👤 === GET USER REQUEST COMPLETED ===\n');
        
        res.status(200).json({ status: true, result: userData });
      } catch (blockchainError) {
        gateway.disconnect();
        console.error(`❌ Blockchain read error for user ${username}:`, blockchainError.message);
        console.log('👤 === GET USER REQUEST FAILED ===\n');
        return res.status(500).json({ 
          errorMessage: `Failed to read user data from blockchain`,
          status: false 
        });
      }
    });
  } catch (error) {
    console.error('💥 GetUser endpoint error:', error);
    console.log('👤 === GET USER REQUEST FAILED ===\n');
    res.status(500).json({ errorMessage: `Failed to evaluate transaction: ${error}`, status: false });
  }
});


// Server configuration from environment variables
const SERVER_PORT = process.env.SERVER_PORT || 2000;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('🔌 === WEBSOCKET CONNECTION REQUEST STARTED ===');
  
  let username = null;
  let heartbeatInterval = null;

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📝 WebSocket message received:', data);

      if (data.type === 'authenticate') {
        const token = data.token;
        if (!token) {
          console.log('❌ No token provided for WebSocket connection');
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Token is missing!'
          }));
          ws.close();
          return;
        }

        jwt.verify(token, JWT_SECRET, (err, decoded) => {
          if (err || !decoded?.user) {
            console.log('❌ Token verification failed for WebSocket:', err?.message);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'User unauthorized!'
            }));
            ws.close();
            return;
          }

          username = decoded.user;
          console.log(`📡 WebSocket authenticated for user: ${username}`);

          // Store the connection
          if (!wsConnections.has(username)) {
            wsConnections.set(username, []);
          }
          wsConnections.get(username).push(ws);

          // Send initial connection confirmation
          ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Real-time notifications connected',
            timestamp: new Date().toISOString()
          }));

          console.log(`✅ WebSocket connection established for ${username}. Total connections: ${wsConnections.size}`);

          // Start heartbeat
          heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'HEARTBEAT',
                timestamp: new Date().toISOString()
              }));
            } else {
              clearInterval(heartbeatInterval);
            }
          }, 30000); // Send heartbeat every 30 seconds
        });
      } else if (data.type === 'pong') {
        // Handle pong response
        console.log(`💓 Received pong from ${username}`);
      }
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    if (username) {
      console.log(`🔌 WebSocket connection closed for ${username}`);
      const userConnections = wsConnections.get(username) || [];
      const index = userConnections.indexOf(ws);
      if (index !== -1) {
        userConnections.splice(index, 1);
      }
      if (userConnections.length === 0) {
        wsConnections.delete(username);
      }
      console.log(`📊 Remaining WebSocket connections: ${wsConnections.size}`);
    }
    
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  // Handle connection error
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${username || 'unknown'}:`, error);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });
});

server.listen(SERVER_PORT, () => {
  console.log(`Server is Running On port ${SERVER_PORT}`);
  console.log("🌟 DeRideFair Backend Ready!");
  console.log("📋 Available APIs:");
  console.log("   - POST /login");
  console.log("   - POST /register");
  console.log("   - GET /history");
  console.log("   - GET /GetUser");
  console.log("   - POST /update-user");
  console.log("   - POST /update-database");
  console.log("🔌 WebSocket server running on ws://localhost:" + SERVER_PORT + "/ws");
});