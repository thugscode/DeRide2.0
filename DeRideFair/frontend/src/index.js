import React from "react";
import { createRoot } from "react-dom/client";
//import { Route } from "react-router";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";
import History from "./History";
import AssignmentHistory from "./AssignmentHistory";
import ErrorBoundary from "./ErrorBoundary";
import "./Login.css";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
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
  </ErrorBoundary>
);
