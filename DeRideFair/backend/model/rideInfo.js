const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LocationSchema = new Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
});

const RiderSchema = new Schema({
  user: { type: String, required: true },
  Destination: { type: LocationSchema, required: true },
  Source: { type: LocationSchema, required: true }
});

const RideInfoSchema = new Schema({
  Assigned: { type: Boolean, required: true },
  Destination: { type: LocationSchema, required: true },
  Driver: { type: String, required: true },
  ID: { type: String, required: true },
  Path: { type: [LocationSchema], required: true }, // Update this line
  Riders: { type: [RiderSchema], required: true },
  Role: { type: String, required: true },
  Seats: { type: Number, required: true },
  Source: { type: LocationSchema, required: true },
  Threshold: { type: Number, required: true },
  Date: { type: Date, required: true },
  Time: { type: String, required: true }
});

module.exports = mongoose.model('RideInfo', RideInfoSchema);