# Hyperledger Fabric Network Setup Guide for DeRideFair Testing

## Current Status
✅ Chaincode CLI test scripts created and functional
❌ Hyperledger Fabric network configuration needed

## Error Analysis
The tests are failing with: `FABRIC_CFG_PATH /home/shailesh/DeRide2.0/../config does not exist`

This indicates that the Hyperledger Fabric network environment is not properly configured.

## Required Setup Steps

### 1. Install Hyperledger Fabric Prerequisites
```bash
# Install Docker and Docker Compose
sudo apt update
sudo apt install docker.io docker-compose

# Install Node.js and npm (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Go (if not already installed)
wget https://golang.org/dl/go1.19.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.19.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
```

### 2. Download Hyperledger Fabric Samples and Binaries
```bash
# Navigate to your project directory
cd /home/shailesh

# Download Fabric samples, binaries, and Docker images
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.4.7 1.5.2

# This creates fabric-samples directory with test-network
```

### 3. Set Up Test Network
```bash
# Navigate to test network
cd fabric-samples/test-network

# Bring up the test network
./network.sh up createChannel -ca

# This creates:
# - 2 peer organizations (Org1, Org2)
# - 1 orderer organization
# - Channel "mychannel"
```

### 4. Install and Deploy Your Chaincode
```bash
# Copy your chaincode to fabric-samples
cp -r /home/shailesh/DeRide2.0/DeRideFair/chaincode/javascript \
      /home/shailesh/fabric-samples/chaincode/deridefair

# Package the chaincode
./network.sh deployCC -ccn deridefair -ccp ../chaincode/deridefair -ccl javascript

# This will:
# - Package the chaincode
# - Install on all peers
# - Approve and commit the chaincode definition
```

### 5. Configure Environment Variables
```bash
# Set up peer CLI environment (for Org1)
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/home/shailesh/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/home/shailesh/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Set Fabric config path
export FABRIC_CFG_PATH=/home/shailesh/fabric-samples/config
```

### 6. Update Test Scripts Configuration
Update the configuration in your test scripts:

```bash
# Update these variables in both scripts:
CHANNEL_NAME="mychannel"
CHAINCODE_NAME="deridefair"
ORDERER_ADDRESS="localhost:7050"
PEER_ADDRESS="localhost:7051"
ORDERER_CA="/home/shailesh/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

# Update MSP paths:
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH="/home/shailesh/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
```

## Quick Start Commands

### Option 1: Use Fabric Test Network Setup
```bash
# 1. Download and setup Fabric
cd /home/shailesh
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.4.7 1.5.2

# 2. Start test network
cd fabric-samples/test-network
./network.sh up createChannel -ca

# 3. Deploy your chaincode
./network.sh deployCC -ccn deridefair -ccp /home/shailesh/DeRide2.0/DeRideFair/chaincode/javascript -ccl javascript

# 4. Set environment
export FABRIC_CFG_PATH=$PWD/../config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# 5. Test health check
peer chaincode query -C mychannel -n deridefair -c '{"Args":["HealthCheck"]}'
```

### Option 2: Use Your Existing Network Scripts
If you have existing network setup scripts in your project:
```bash
cd /home/shailesh/DeRide2.0/DeRideFair
./startFabric.sh  # If this script exists and sets up your network
```

## Verification Commands
After setup, test with:
```bash
# Check network status
docker ps

# Test chaincode
peer chaincode query -C mychannel -n deridefair -c '{"Args":["HealthCheck"]}'

# Run your test scripts
cd /home/shailesh/DeRide2.0/DeRideFair/chaincode/javascript
./run-chaincode-tests.sh
```

## Troubleshooting
- **Docker not running:** `sudo systemctl start docker`
- **Permission issues:** Add user to docker group: `sudo usermod -aG docker $USER`
- **Port conflicts:** Check if ports 7050, 7051, 9051 are available
- **Path issues:** Ensure all paths in scripts match your actual directory structure
