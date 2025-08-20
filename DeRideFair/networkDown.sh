#!/bin/bash
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# Exit on first error
set -ex

# Bring the test network down

# give the test-network direct here.
pushd /home/shailesh/Hyperledger/fabric/fabric-samples/test-network
./network.sh down
popd

# clean out any old identities in the backend wallet
rm -rf backend/wallet/*
