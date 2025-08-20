const { ChaincodeStub, ClientIdentity } = require('fabric-shim');
const UserTransfer = require('../lib/userTransfer'); // Ensure correct import
const { expect } = require('chai');
const sinon = require('sinon');
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
let transactionContext, chaincodeStub, clientIdentity;
    transactionContext = {
        stub: sinon.createStubInstance(ChaincodeStub),
        clientIdentity: sinon.createStubInstance(ClientIdentity)
    };
    chaincodeStub = transactionContext.stub;
    clientIdentity = transactionContext.clientIdentity;

describe('InitLedger', () => {
    it('should initialize the ledger with predefined users', async () => {
        const userTransfer = new UserTransfer();
        await userTransfer.InitLedger(transactionContext);

        const users = [
            { ID: 'user1', Source: {nodeid:'00', x:0, y:0}, Destination: {nodeid:'99', x:9, y:9}, Token: 10, Role: 'driver', Seats: 3, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 0, Assigned: false}, 
            { ID: 'user2', Source: {nodeid:'90', x:9, y:0}, Destination: {nodeid:'09', x:0, y:9}, Token: 10, Role: 'driver', Seats: 3, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 0, Assigned: false},
            { ID: 'user3', Source: {nodeid:'30', x:3, y:0}, Destination: {nodeid:'69', x:6, y:9}, Token: 10, Role: 'driver', Seats: 3, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 0, Assigned: false},
            { ID: 'user4', Source: {nodeid:'72', x:7, y:2}, Destination: {nodeid:'39', x:3, y:9}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user5', Source: {nodeid:'24', x:2, y:4}, Destination: {nodeid:'88', x:8, y:8}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user6', Source: {nodeid:'81', x:8, y:1}, Destination: {nodeid:'17', x:1, y:7}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user7', Source: {nodeid:'40', x:4, y:0}, Destination: {nodeid:'59', x:5, y:9}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user8', Source: {nodeid:'22', x:2, y:2}, Destination: {nodeid:'85', x:8, y:5}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user9', Source: {nodeid:'11', x:1, y:1}, Destination: {nodeid:'88', x:8, y:8}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user10', Source: {nodeid:'29', x:2, y:9}, Destination: {nodeid:'31', x:3, y:1}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
            { ID: 'user11', Source: {nodeid:'21', x:2, y:1}, Destination: {nodeid:'99', x:9, y:9}, Token: 10, Role: 'rider', Seats: 0, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 2, Assigned: false},
        ];

        for (const user of users) {
            const expectedUser = Buffer.from(stringify(user));
            sinon.assert.calledWith(chaincodeStub.putState, user.ID, expectedUser);
        }
    });
});

describe('CreateUser', () => {
    it('should create a new user', async () => {
        const userTransfer = new UserTransfer();
        const user = {
            ID: 'user12',
            Source: {nodeid:'50', x:5, y:0},
            Destination: {nodeid:'60', x:6, y:0},
            Token: 15,
            Role: 'driver',
            Seats: 4,
            Threshold: 5,
            Radius: 3
        };

        await userTransfer.CreateUser(
            transactionContext,
            user.ID,
            JSON.stringify(user.Source),
            JSON.stringify(user.Destination),
            user.Token.toString(),
            user.Role,
            user.Seats.toString(),
            user.Threshold.toString(),
            user.Radius.toString()
        );

        const expectedUser = {
            ID: user.ID,
            Source: user.Source,
            Destination: user.Destination,
            Token: user.Token,
            Role: user.Role,
            Seats: user.Seats,
            Riders: [],
            Path: [],
            Driver: '',
            Threshold: user.Threshold,
            Radius: user.Radius,
            Assigned: false
        };

        sinon.assert.calledWith(chaincodeStub.putState, user.ID, Buffer.from(stringify(expectedUser)));
    });

    it('should throw an error if the user already exists', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from('some data'));

        try {
            await userTransfer.CreateUser(
                transactionContext,
                'user1',
                '{"nodeid":"00","x":0,"y":0}',
                '{"nodeid":"99","x":9,"y":9}',
                '10',
                'driver',
                '3',
                '0',
                '0'
            );
            expect.fail('Expected error to be thrown');
        } catch (err) {
            expect(err.message).to.equal('The user user1 already exists');
        }
    });
});
describe('ReadUser', () => {
    it('should return a user by ID', async () => {
        const userTransfer = new UserTransfer();
        const user = {
            ID: 'user1',
            Source: {nodeid:'00', x:0, y:0},
            Destination: {nodeid:'99', x:9, y:9},
            Token: 10,
            Role: 'driver',
            Seats: 3,
            Riders: [],
            Path: [],
            Driver: '',
            Threshold: 0,
            Radius: 0,
            Assigned: false
        };
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from(JSON.stringify(user)));

        const result = await userTransfer.ReadUser(transactionContext, 'user1');
        expect(result).to.equal(JSON.stringify(user));
    });

    it('should throw an error if the user does not exist', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from(''));

        try {
            await userTransfer.ReadUser(transactionContext, 'user1');
            expect.fail('Expected error to be thrown');
        } catch (err) {
            expect(err.message).to.equal('The user user1 does not exist');
        }
    });
});

describe('UpdateUser', () => {
    it('should update an existing user', async () => {
        const userTransfer = new UserTransfer();
        const user = {
            ID: 'user1',
            Source: {nodeid:'00', x:0, y:0},
            Destination: {nodeid:'99', x:9, y:9},
            Token: 10,
            Role: 'driver',
            Seats: 3,
            Riders: [],
            Path: [],
            Driver: '',
            Threshold: 0,
            Radius: 0,
            Assigned: false
        };
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from(JSON.stringify(user)));

        const updatedUser = {
            ID: 'user1',
            Source: {nodeid:'00', x:0, y:0},
            Destination: {nodeid:'99', x:9, y:9},
            Token: 20,
            Role: 'driver',
            Seats: 4,
            Riders: [],
            Path: [],
            Driver: '',
            Threshold: 5,
            Radius: 3,
            Assigned: false
        };

        await userTransfer.UpdateUser(
            transactionContext,
            updatedUser.ID,
            JSON.stringify(updatedUser.Source),
            JSON.stringify(updatedUser.Destination),
            updatedUser.Token,
            updatedUser.Role,
            updatedUser.Seats,
            updatedUser.Threshold,
            updatedUser.Radius
        );

        sinon.assert.calledWith(chaincodeStub.putState, updatedUser.ID, Buffer.from(stringify(sortKeysRecursive(updatedUser))));
    });

    it('should throw an error if the user does not exist', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from(''));

        try {
            await userTransfer.UpdateUser(
                transactionContext,
                'user1',
                '{"nodeid":"00","x":0,"y":0}',
                '{"nodeid":"99","x":9,"y":9}',
                20,
                'driver',
                4,
                5,
                3
            );
            expect.fail('Expected error to be thrown');
        } catch (err) {
            expect(err.message).to.equal('The user user1 does not exist');
        }
    });
});

describe('DeleteUser', () => {
    it('should delete an existing user', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from('some data'));

        await userTransfer.DeleteUser(transactionContext, 'user1');
        sinon.assert.calledWith(chaincodeStub.deleteState, 'user1');
    });

    it('should throw an error if the user does not exist', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from(''));

        try {
            await userTransfer.DeleteUser(transactionContext, 'user1');
            expect.fail('Expected error to be thrown');
        } catch (err) {
            expect(err.message).to.equal('The user user1 does not exist');
        }
    });
});

describe('UserExists', () => {
    it('should return true if the user exists', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from('some data'));

        const result = await userTransfer.UserExists(transactionContext, 'user1');
        expect(result).to.be.true;
    });

    it('should return false if the user does not exist', async () => {
        const userTransfer = new UserTransfer();
        chaincodeStub.getState.withArgs('user1').resolves(Buffer.from(''));

        const result = await userTransfer.UserExists(transactionContext, 'user1');
        expect(result).to.be.false;
    });
});

describe('GetAllUsers', () => {
    it('should return all users', async () => {
        const userTransfer = new UserTransfer();
        const users = [
            { ID: 'user1', Source: {nodeid:'00', x:0, y:0}, Destination: {nodeid:'99', x:9, y:9}, Token: 10, Role: 'driver', Seats: 3, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 0, Assigned: false}, 
            { ID: 'user2', Source: {nodeid:'90', x:9, y:0}, Destination: {nodeid:'09', x:0, y:9}, Token: 10, Role: 'driver', Seats: 3, Riders: [], Path: [], Driver: '', Threshold: 0, Radius: 0, Assigned: false}
        ];
        const iterator = {
            next: sinon.stub()
        };
        iterator.next.onCall(0).resolves({ value: { value: Buffer.from(JSON.stringify(users[0])) }, done: false });
        iterator.next.onCall(1).resolves({ value: { value: Buffer.from(JSON.stringify(users[1])) }, done: false });
        iterator.next.onCall(2).resolves({ done: true });

        chaincodeStub.getStateByRange.resolves(iterator);

        const result = await userTransfer.GetAllUsers(transactionContext);
        expect(result).to.equal(JSON.stringify(users));
    });
});