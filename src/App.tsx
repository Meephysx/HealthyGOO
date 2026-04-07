import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { NutritionProvider } from "./context/NutritionContext";
import { DailyLogProvider } from "./context/DailyLogContext";
import { useAuth } from "./context/AuthContext";

import Layout from "./components/Layout";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import MealPlanning from "./components/MealPlanning";
import Profile from "./components/Profile";
import Onboarding from "./components/Onboarding";
import Workouts from "./components/ExercisePlanning";
import FoodSearch from "./components/FoodSearch";
import Progress from "./components/Progress";
import AiChat from "./pages/AiChat";


// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <NutritionProvider>
        <DailyLogProvider>
          <Routes>
            {/* Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Onboarding */}
            <Route
              path="/onboarding"
              element={<Onboarding />} 
            />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Note: User bisa akses exercises lewat dashboard atau link lain, 
              karena menu 'Plan' saat ini mengarah ke Meals */}
            <Route
              path="/exercises"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Workouts />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/food-search"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FoodSearch />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Progress />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/meals"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MealPlanning />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* AI Chat Page (No LayoutWithNav) */}
            <Route
              path="/ai-chat"
              element={
                <ProtectedRoute>
                  <AiChat />
                </ProtectedRoute>
              }
            />
          </Routes>
        </DailyLogProvider>
      </NutritionProvider>
    </Router>
  );
}

export default App;
