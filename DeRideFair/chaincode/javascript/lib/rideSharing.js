'use strict';

require('dotenv').config({ path: '../.env.local' }); // Load environment variables

const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');
const axios = require('axios');
const polyline = require('@mapbox/polyline');

// Fallback API key for when environment variable is not available (e.g., in Docker container)
const FALLBACK_API_KEY = 'GoogleMapsAPIKey';

// Helper function to get API key
function getApiKey() {
    return process.env.GOOGLE_MAPS_API_KEY || FALLBACK_API_KEY;
}

class rideSharing extends Contract {
    
    async CreateUser(ctx, id) {
        try {
            if (!id || typeof id !== 'string') throw new Error("Invalid ID");
        
            const exists = await this.UserExists(ctx, id);
            if (exists) {
                throw new Error(`The user ${id} already exists`);
            }
        
            const user = {
                ID: id,
                Source: {
                    lat: 0,
                    lng: 0
                },
                Destination: {
                    lat: 0,
                    lng: 0
                },
                Token: 10,
                Role: '',
                Seats: 0,
                Riders: [],
                Driver: '',
                Threshold: 0,
                Assigned: false
            };
            console.log('User Created:', user);
            // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(user))));
            return JSON.stringify(user);
        } catch (error) {
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }


    // UpdateUser updates an existing user in the world state with provided parameters.
    async UpdateUser(ctx, id, Source, Destination, role, seats, threshold) {
        try {
            if (!id || typeof id !== 'string') throw new Error("Invalid ID");
            if (!Source || typeof Source !== 'string' || !this.isValidJSON(Source)) throw new Error("Invalid Source");
            if (!Destination || typeof Destination !== 'string' || !this.isValidJSON(Destination)) throw new Error("Invalid Destination");
        
            // Parse numeric arguments
            seats = parseInt(seats);
            threshold = parseInt(threshold);
        
            if (!role || typeof role !== 'string') throw new Error("Invalid Role");
            if (isNaN(seats)) throw new Error("Invalid Seats");
            if (isNaN(threshold)) throw new Error("Invalid Threshold");
    
            const exists = await this.UserExists(ctx, id);
            if (!exists) {
                throw new Error(`The user ${id} does not exist`);
            }

            // Get the existing user to preserve Token and other fields
            const existingUserJSON = await ctx.stub.getState(id);
            const existingUser = JSON.parse(existingUserJSON.toString());
    
            let SourceObj;
            let DestinationObj;
            try {
                SourceObj = JSON.parse(Source);
                DestinationObj = JSON.parse(Destination);
            } catch (err) {
                throw new Error("Invalid format for Source or Destination. Both should be valid JSON strings.");
            }
    
            // Overwriting original user with new user, preserving Token and other existing fields
            const updatedUser = {
                ID: id,
                Source: {
                    lat: SourceObj.lat,
                    lng: SourceObj.lng
                },
                Destination: {
                    lat: DestinationObj.lat,
                    lng: DestinationObj.lng
                },
                Token: existingUser.Token, // Preserve existing Token
                Role: role,
                Seats: seats,
                Riders: [], // Preserve existing Riders
                Driver: '', // Preserve existing Driver
                Threshold: threshold,
                Assigned: false // Reset Assigned status
            };
            console.log('User Updated:', updatedUser);
            // Insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedUser))));
        } catch (error) {
            throw new Error(`Failed to update user: ${error.message}`);
        }
    }

    // ReadUser returns the user stored in the world state with given id.
    async ReadUser(ctx, id) {
        try {
            const userJSON = await ctx.stub.getState(id); // get the user from chaincode state
            if (!userJSON || userJSON.length === 0) {
                throw new Error(`The user ${id} does not exist`);
            }
            return userJSON.toString();
        } catch (error) {
            throw new Error(`Failed to read user: ${error.message}`);
        }
    }

    async getPathAndDistance(source, destination) {
        try {
            const origins = `${source.lat},${source.lng}`;
            const destinations = `${destination.lat},${destination.lng}`;

            const apiKey = getApiKey();
            const directionsApiUrl = `https://maps.googleapis.com/maps/api/directions/json`;

            const directionsParams = {
                origin: origins,
                destination: destinations,
                key: apiKey,
                mode: "driving",
                units: "metric",
            };
            const directionsResponse = await axios.get(directionsApiUrl, { params: directionsParams });

        if (directionsResponse.data.status !== "OK") {
            throw new Error(`Error fetching data from Google Maps Directions API: ${directionsResponse.data.error_message}`);
        }

        if (!directionsResponse.data.routes || directionsResponse.data.routes.length === 0) {
            throw new Error('No routes found in Google Maps API response');
        }

        const route = directionsResponse.data.routes[0];
        if (!route.legs || route.legs.length === 0) {
            throw new Error('No route legs found in Google Maps API response');
        }

        const distance = route.legs[0].distance.value;            return { distance };
        } catch (error) {
            throw new Error(`Failed to get distance: ${error.message}`);
        }
    }  

    async deviated_path_with_single_rider(driver, rider) {
        try {
            // Use Google Directions API with waypoints (rider's source and destination)
            const apiKey = getApiKey(); // Use API key from .env.local or fallback
            const directionsApiUrl = `https://maps.googleapis.com/maps/api/directions/json`;

            const origins = `${driver.Source.lat},${driver.Source.lng}`;
            const destinations = `${driver.Destination.lat},${driver.Destination.lng}`;
            const waypoints = `${rider.Source.lat},${rider.Source.lng}|${rider.Destination.lat},${rider.Destination.lng}`;

            const directionsParams = {
                origin: origins,
                destination: destinations,
                waypoints: waypoints,
                optimizeWaypoints: true,
                key: apiKey,
                mode: "driving",
                units: "metric",
            };

            const directionsResponse = await axios.get(directionsApiUrl, { params: directionsParams });

            if (directionsResponse.data.status !== "OK") {
                throw new Error(`Error fetching data from Google Maps Directions API: ${directionsResponse.data.error_message}`);
            }

            if (!directionsResponse.data.routes || directionsResponse.data.routes.length === 0) {
                throw new Error('No routes found in Google Maps API response');
            }

            const route = directionsResponse.data.routes[0];
            if (!route.legs || route.legs.length === 0) {
                throw new Error('No route legs found in Google Maps API response');
            }

            const totalDevitedPathLength = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);

            return totalDevitedPathLength;
        } catch (error) {
            throw new Error(`Failed to calculate deviated path length: ${error.message}`);
        }
    }
     
    async MatrixCalculation(ctx) {
        try {
            console.log('###################Calculating matrix##########################');
            const allResults = [];
            const iterator = await ctx.stub.getStateByRange('', '');
            let result = await iterator.next();
        
            // Fetch all users from state
            while (!result.done) {
                const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                } catch (err) {
                    console.log(err);
                    record = strValue;
                }
                allResults.push(record);
                result = await iterator.next();
            }
            await iterator.close(); // Close iterator to prevent memory leaks
        
            const users = allResults; // Ensure this is an array
        
            // Filter drivers and riders
            const drivers = users.filter(user => user.Role === 'driver' && user.Assigned === false);
            const riders = users.filter(user => user.Role === 'rider' && user.Assigned === false);
        
            let num_drivers = drivers.length;
            console.log('Number of Drivers:', num_drivers);
            let num_riders = riders.length;
            console.log('Number of Riders:', num_riders);
            let ER = Array.from({ length: num_drivers }, () => Array(num_riders).fill(0));
    
        
            for (const [i, driver] of drivers.entries()) {
                const { distance: SP } = await this.getPathAndDistance(driver.Source, driver.Destination);
                console.log('Driver SP:', SP);
                const t = driver.Threshold;
                
                for (let j = 0; j < riders.length; j++) {
                    const rider = riders[j];
                    const MP = SP * (1 + (t / 100));
                    const DP = await this.deviated_path_with_single_rider(driver, rider);
                    if (DP <= MP) {
                        ER[i][j] = 1;
                        console.log('Rider is within threshold');
                    }
                }
            }
            // Save the eligibility matrix to the ledger
            const ERKey = 'ERMatrix'; // Define a key for storing the matrix
            
            await ctx.stub.putState(ERKey, Buffer.from(JSON.stringify(ER)));
        } catch (error) {
            throw new Error(`Failed to calculate matrix: ${error.message}`);
        }
    }
    

    async getEligibilityMatrix(ctx) {
        try {
            const ERKey = 'ERMatrix';
            const ERStateBytes = await ctx.stub.getState(ERKey);
            if (!ERStateBytes || ERStateBytes.length === 0) {
                throw new Error('Eligibility Matrix not found');
            }
        
            const ERState = JSON.parse(ERStateBytes.toString());
            console.log('Retrieved Eligibility Matrix:', ERState);
            return ERState;
        } catch (error) {
            throw new Error(`Failed to get eligibility matrix: ${error.message}`);
        }
    }

    async select_driver(ctx, eligible_drivers, drivers, newRider) {
        try {
            // 1. Calculate load for each eligible driver
            let loadMap = {};
            eligible_drivers.forEach(idx => {
                const driver = drivers[idx];
                loadMap[idx] = driver.Riders ? driver.Riders.length : 0;
            });

            // 2. Group drivers by load
            let groups = {};
            for (const [idx, load] of Object.entries(loadMap)) {
                if (!groups[load]) groups[load] = [];
                groups[load].push(Number(idx));
            }
            const sortedLoads = Object.keys(groups).map(Number).sort((a, b) => a - b);

            // 3. Iterate groups from smallest load
            for (const load of sortedLoads) {
                const group = groups[load];
                if (group.length === 0) continue;

                // 2b. Randomly select a driver from the group
                const blockHash = await this.getTransactionID(ctx);
                const randomIndex = await this.hashToRandom(blockHash, 'driver') % group.length;
                const selectedIdx = group[randomIndex];
                const driver = drivers[selectedIdx];

                // 3. Find optimal route using waypoints (assigned riders + new rider)
                const { distance: shortestDistance } = await this.getPathAndDistance(driver.Source, driver.Destination);
                
                const t = driver.Threshold;

                // Prepare waypoints: all assigned riders + new rider
                let waypointsArr = [];
                if (driver.Riders && Array.isArray(driver.Riders)) {
                    driver.Riders.forEach(riderObj => {
                        const rider = Object.values(riderObj)[0];
                        waypointsArr.push(`${rider.Source.lat},${rider.Source.lng}`);
                        waypointsArr.push(`${rider.Destination.lat},${rider.Destination.lng}`);
                    });
                }
                waypointsArr.push(`${newRider.Source.lat},${newRider.Source.lng}`);
                waypointsArr.push(`${newRider.Destination.lat},${newRider.Destination.lng}`);
                const waypoints = waypointsArr.join('|');
                const apiKey = getApiKey();
                const directionsApiUrl = `https://maps.googleapis.com/maps/api/directions/json`;

                const origins = `${driver.Source.lat},${driver.Source.lng}`;
                const destinations = `${driver.Destination.lat},${driver.Destination.lng}`;

                const directionsParams = {
                    origin: origins,
                    destination: destinations,
                    waypoints: waypoints,
                    optimizeWaypoints: true,
                    key: apiKey,
                    mode: "driving",
                    units: "metric",
                };

                const directionsResponse = await axios.get(directionsApiUrl, { params: directionsParams });
                if (directionsResponse.data.status !== "OK") {
                    continue; // skip this driver if route can't be calculated
                }
                
                if (!directionsResponse.data.routes || directionsResponse.data.routes.length === 0) {
                    continue; // skip this driver if no routes found
                }
                
                const route = directionsResponse.data.routes[0];
                if (!route.legs || route.legs.length === 0) {
                    continue; // skip this driver if no route legs found
                }
                
                const routeLength = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);

                // 4. Check threshold
                const maxDistance = shortestDistance * (1 + (t / 100));
                if (routeLength <= maxDistance) {
                    return selectedIdx;
                }
                // 5. If not, repeat with next random driver in group (handled by loop)
                // 6. If group is empty, continue to next group
            }
            // 7. Return null if no driver found
            return null;
        } catch (error) {
            throw new Error(`Failed to select driver: ${error.message}`);
        }
    }

    async deviated_path_and_length_with_multiple_riders(driver, newRider) {
        try {
            // Collect waypoints: all assigned riders' sources/destinations + new rider's source/destination
            let waypointsArr = [];
            if (driver.Riders && Array.isArray(driver.Riders)) {
                driver.Riders.forEach(riderObj => {
                    const rider = Object.values(riderObj)[0];
                    waypointsArr.push(`${rider.Source.lat},${rider.Source.lng}`);
                    waypointsArr.push(`${rider.Destination.lat},${rider.Destination.lng}`);
                });
            }
            waypointsArr.push(`${newRider.Source.lat},${newRider.Source.lng}`);
            waypointsArr.push(`${newRider.Destination.lat},${newRider.Destination.lng}`);

            const waypoints = waypointsArr.join('|');
            const apiKey = getApiKey();
            const directionsApiUrl = `https://maps.googleapis.com/maps/api/directions/json`;

            const origins = `${driver.Source.lat},${driver.Source.lng}`;
            const destinations = `${driver.Destination.lat},${driver.Destination.lng}`;

            const directionsParams = {
                origin: origins,
                destination: destinations,
                waypoints: waypoints,
                optimizeWaypoints: true,
                key: apiKey,
                mode: "driving",
                units: "metric",
            };

            const directionsResponse = await axios.get(directionsApiUrl, { params: directionsParams });

            if (directionsResponse.data.status !== "OK") {
                throw new Error(`Error fetching data from Google Maps Directions API: ${directionsResponse.data.error_message}`);
            }

            if (!directionsResponse.data.routes || directionsResponse.data.routes.length === 0) {
                throw new Error('No routes found in Google Maps API response');
            }

            const route = directionsResponse.data.routes[0];
            if (!route.legs || route.legs.length === 0) {
                throw new Error('No route legs found in Google Maps API response');
            }

            const totalDevitedPathLength = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0);

            return totalDevitedPathLength;
        } catch (error) {
            throw new Error(`Failed to calculate deviated path for assignment: ${error.message}`);
        }
    }

    async getTransactionID(ctx) {
        try {
            const txID = ctx.stub.getTxID(); // Get the transaction ID
            return txID;
        } catch (error) {
            throw new Error(`Failed to get transaction ID: ${error.message}`);
        }
    }
    
    async hashToRandom(blockHash, seed) {
        try {
            const hash = crypto.createHash('sha256').update(blockHash + seed).digest('hex');
            const randomValue = parseInt(hash.slice(0, 8), 16); // Convert the first 8 characters of the hash to an integer
            return randomValue;
        } catch (error) {
            throw new Error(`Failed to generate random value from hash: ${error.message}`);
        }
    }

    async assign_riders_to_drivers(ctx, ER, drivers, riders) {
        try {
            let DP_assigned = {};
            let num_drivers = drivers.length;
            let num_riders = riders.length;
        
            let offers = Array(num_riders).fill(0);
            console.log('Offers:', offers);
            ER.forEach(row => row.forEach((value, colIndex) => { offers[colIndex] += value; }));
        
            drivers.forEach(driver => {
                DP_assigned[driver.ID] = { riders: []};
            });
            console.log(' Before DP Assigned:', DP_assigned);
            while (offers.reduce((a, b) => a + b, 0) > 0) {
                
                let non_zero_offers = offers.filter(offer => offer > 0);
    
                console.log('Offers:', offers);
    
                if (non_zero_offers.length === 0) {
                    break;
                }
    
                let min_offer = Math.min(...non_zero_offers);
                let min_offer_set = [];
                console.log('Min Offer:', min_offer);
                offers.forEach((element, i) => { if (element === min_offer) { min_offer_set.push(i); } });
        
                const blockHash = await this.getTransactionID(ctx); // Get the transaction ID
                const randomIndex = await this.hashToRandom(blockHash, 'rider') % min_offer_set.length; // Generate a random index
                console.log('Random Index:', randomIndex);
                const r_selected = min_offer_set[randomIndex];
    
                const eligible_drivers = [];
                
                ER.forEach((driver_row, i) => driver_row.forEach((value, j) => { 
                    if (j === r_selected && value === 1) { 
                        eligible_drivers.push(i); 
                    } 
                }));
                const d_assigned = await this.select_driver(ctx, eligible_drivers, drivers, riders[r_selected]);
                
                if (d_assigned === null) {
                    console.log('No eligible driver found for rider:', r_selected);
                    offers[r_selected] = 0; // Remove rider from offers
                    continue;
                }

                let driver = drivers[d_assigned];
                let rider = riders[r_selected];
    
                console.log('Selected Driver:', driver, 'Selected Rider:', rider);
    
                // Check if driver has available seats before assignment
                if (drivers[d_assigned].Seats === 0) {
                    console.log('Driver has no available seats:', driver.ID);
                    ER[d_assigned] = Array(riders.length).fill(0);
                    offers = Array(num_riders).fill(0);
                    ER.forEach(row => row.forEach((value, colIndex) => { offers[colIndex] += value; }));
                    continue;
                }
    
                DP_assigned[driver.ID]['riders'].push({
                    ID: rider.ID,
                    Source: rider.Source,
                    Destination: rider.Destination
                });
                
                for (let d = 0; d < drivers.length; d++) {
                    ER[d][r_selected] = 0;
                }
                drivers[d_assigned].Seats -= 1;
                if (drivers[d_assigned].Seats === 0) {
                    ER[d_assigned] = Array(riders.length).fill(0);
                }
                // Reset offers array and recalculate
                offers = Array(num_riders).fill(0);
                ER.forEach(row => row.forEach((value, colIndex) => { offers[colIndex] += value; }));
            }
            console.log('After DP Assigned:', DP_assigned);
            return DP_assigned;
        } catch (error) {
            throw new Error(`Failed to assign riders to drivers: ${error.message}`);
        }
    }


    // DoAssignment assigns a rider to a driver
    async DoAssignment(ctx) {
        try {
            const allResults = [];
            const iterator = await ctx.stub.getStateByRange('', '');
            let result = await iterator.next();
    
            while (!result.done) {
                const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                } catch (err) {
                    console.log(err);
                    record = strValue;
                }
                allResults.push(record);
                result = await iterator.next();
            }
            await iterator.close(); // Close iterator to prevent memory leaks
    
            const users = allResults; // Ensure this is an array
    
            const drivers = users.filter(user => user.Role === 'driver' && user.Assigned === false && user.Seats > 0);
            const riders = users.filter(user => user.Role === 'rider' && user.Assigned === false && user.Token > 0);
    
            if (drivers.length > 0 || riders.length > 0) {
                console.log('Drivers:', drivers, 'Riders:', riders);
                const ERKey = 'ERMatrix';
                const ERStateBytes = await ctx.stub.getState(ERKey);
                if (!ERStateBytes || ERStateBytes.length === 0) {
                    throw new Error('Eligibility Matrix not found');
                }
        
                const ER = JSON.parse(ERStateBytes.toString());
                console.log('Eligibility Matrix:', ER);
                let DPassigned = await this.assign_riders_to_drivers(ctx, ER, drivers, riders);
        
                users.forEach(user => {
                    if (user.Role === 'driver') {
                        if (DPassigned[user.ID] && DPassigned[user.ID].riders.length > 0) {
                            DPassigned[user.ID].riders.forEach(rider => {   
                                let riderid = rider.ID;
                                // Store rider information with their actual source and destination
                                user.Token += 2;
                                user.Riders.push({ 
                                    [riderid]: { 
                                        Source: { lat: rider.Source.lat, lng: rider.Source.lng }, 
                                        Destination: { lat: rider.Destination.lat, lng: rider.Destination.lng } 
                                    } 
                                });
                            });
            
                            user.Assigned = true;
                        }
                        
                    } else if (user.Role === 'rider') {
                        let driverid = null;
        
                        // Find the driver this rider is assigned to
                        Object.entries(DPassigned).forEach(([key, element]) => {
                            if (element.riders.some(rider => rider.ID === user.ID)) {
                                driverid = key;
                            }
                        });
        
                        // Skip this rider if no driver assignment found
                        if (driverid === null || !DPassigned[driverid]) {
                            console.log(`No driver assignment found for rider: ${user.ID}`);
                            return; // This now correctly skips to next iteration
                        }
        
                        user.Token -= 2;
                        // Store driver information with rider's actual source and destination
                        user.Driver = { 
                            ID: driverid, 
                            Source: { lat: user.Source.lat, lng: user.Source.lng }, 
                            Destination: { lat: user.Destination.lat, lng: user.Destination.lng } 
                        };
                        
                        user.Assigned = true;
                    }
                });
        
                for (const user of users) {
                    // example of how to write to world state deterministically
                    // use convention of alphabetic order
                    // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
                    // when retrieving data, in any lang, the order of data will be the same and consequently also the corresponding hash
                    if (user.Role === 'driver' || user.Role === 'rider') {
                        try {
                            await ctx.stub.putState(user.ID, Buffer.from(stringify(sortKeysRecursive(user))));
                        } catch (error) {
                            console.error(`Failed to update user ${user.ID}:`, error.message);
                            throw new Error(`Failed to update user ${user.ID}: ${error.message}`);
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error(`Failed to perform assignment: ${error.message}`);
        }
    }

    // Helper function to check if a string is a valid JSON
    isValidJSON(str) {
        try {
            JSON.parse(str);
        } catch (e) {
            return false;
        }
        return true;
    }

    // GetNumberOfUsers returns the total number of users in the world state.
    async GetNumberOfUsers(ctx) {
        try {
            const allResults = [];
            const iterator = await ctx.stub.getStateByRange('', '');
            let result = await iterator.next();
            
            while (!result.done) {
                const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                } catch (err) {
                    console.log(err);
                    record = strValue;
                }
                allResults.push(record);
                result = await iterator.next();
            }
            await iterator.close(); // Close iterator to prevent memory leaks
            
            // Filter users where Assigned is false
            const unassignedUsers = allResults.filter(user => user.Assigned === false);
            
            return unassignedUsers.length;
        } catch (error) {
            throw new Error(`Failed to get number of users: ${error.message}`);
        }
    }


    // UserExists returns true when user with given ID exists in world state.
    async UserExists(ctx, id) {
        const userJSON = await ctx.stub.getState(id);
        return userJSON && userJSON.length > 0;
    }

    // GetAllUsersInfo returns comprehensive information about all riders, drivers, and rides for admin purposes
    async GetAllUsersInfo(ctx) {
        try {
            const allResults = [];
            const iterator = await ctx.stub.getStateByRange('', '');
            let result = await iterator.next();
            
            while (!result.done) {
                const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
                let record;
                try {
                    record = JSON.parse(strValue);
                    // Only include user records (exclude system records like ERMatrix)
                    if (record && record.ID && (record.Role === 'driver' || record.Role === 'rider')) {
                        allResults.push(record);
                    }
                } catch (err) {
                    console.log('Error parsing record:', err);
                    // Skip invalid records
                }
                result = await iterator.next();
            }
            await iterator.close(); // Close iterator to prevent memory leaks
            
            // Separate users by role and assignment status
            const drivers = allResults.filter(user => user.Role === 'driver');
            const riders = allResults.filter(user => user.Role === 'rider');
            
            const assignedDrivers = drivers.filter(driver => driver.Assigned === true);
            const unassignedDrivers = drivers.filter(driver => driver.Assigned === false);
            
            const assignedRiders = riders.filter(rider => rider.Assigned === true);
            const unassignedRiders = riders.filter(rider => rider.Assigned === false);
            
            // Compile ride information from assigned drivers
            const activeRides = assignedDrivers.map(driver => {
                const rideInfo = {
                    rideId: `ride_${driver.ID}`,
                    driver: {
                        id: driver.ID,
                        source: driver.Source,
                        destination: driver.Destination,
                        tokens: driver.Token,
                        availableSeats: driver.Seats,
                        threshold: driver.Threshold
                    },
                    riders: [],
                    totalRiders: driver.Riders ? driver.Riders.length : 0
                };
                
                // Add rider details to the ride
                if (driver.Riders && Array.isArray(driver.Riders)) {
                    driver.Riders.forEach(riderObj => {
                        const riderId = Object.keys(riderObj)[0];
                        const riderData = riderObj[riderId];
                        rideInfo.riders.push({
                            id: riderId,
                            source: riderData.Source,
                            destination: riderData.Destination
                        });
                    });
                }
                
                return rideInfo;
            });
            
            // Calculate statistics
            const statistics = {
                totalUsers: allResults.length,
                totalDrivers: drivers.length,
                totalRiders: riders.length,
                assignedDrivers: assignedDrivers.length,
                unassignedDrivers: unassignedDrivers.length,
                assignedRiders: assignedRiders.length,
                unassignedRiders: unassignedRiders.length,
                activeRides: activeRides.length,
                totalTokensInSystem: allResults.reduce((sum, user) => sum + (user.Token || 0), 0)
            };
            
            // Compile comprehensive admin information
            const adminInfo = {
                statistics,
                drivers: {
                    assigned: assignedDrivers,
                    unassigned: unassignedDrivers
                },
                riders: {
                    assigned: assignedRiders,
                    unassigned: unassignedRiders
                },
                activeRides,
                allUsers: allResults
            };
            
            return JSON.stringify(adminInfo);
        } catch (error) {
            throw new Error(`Failed to get all users info: ${error.message}`);
        }
    }
    
}

module.exports = rideSharing;
