import React from "react";
import ReactDOM from "react-dom";
//import { Route } from "react-router";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import History from "./History";
import AssignmentHistory from "./AssignmentHistory";
import ErrorBoundary from "./ErrorBoundary";
import "./Login.css";

ReactDOM.render(
  <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/history" element={<History />} />
        <Route path="/assignment-history" element={<AssignmentHistory />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>,
  document.getElementById("root")
);
