import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { isTokenValid, logout, getToken } from './utils/auth';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkOrderList from './pages/WorkOrderList';
import CreateWorkOrder from './pages/CreateWorkOrder';
import WorkOrderDetail from './pages/WorkOrderDetail';
import Profile from './pages/Profile';
import ManageStaff from './pages/ManageStaff';
import Inventory from './pages/Inventory';
import WorkshopRequirements from './pages/WorkshopRequirements';

function App() {
    useEffect(() => {
        const interval = setInterval(() => {
            const token = getToken();
            if (token && !isTokenValid()) {
                console.warn('[App] Session expired — logging out');
                logout();
            }
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <ThemeProvider>
            <Toaster
                position="top-right"
                reverseOrder={false}
                toastOptions={{
                    style: {
                        fontSize: '13px',
                        fontFamily: "'Inter', sans-serif",
                        borderRadius: '12px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-main)',
                    },
                    success: {
                        iconTheme: {
                            primary: 'var(--brand-lime)',
                            secondary: 'var(--brand-black)',
                        },
                    },
                }}
            />
            <Router>
                <Routes>
                    {/* Public */}
                    <Route path="/login" element={<Login />} />

                    {/* Protected — Workshop Dashboard */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<DashboardLayout />}>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/work-orders" element={<WorkOrderList />} />
                            <Route path="/work-orders/create" element={<CreateWorkOrder />} />
                            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                            <Route path="/manage-staff" element={<ManageStaff />} />
                            <Route path="/inventory" element={<Inventory />} />
                            <Route path="/requirements" element={<WorkshopRequirements />} />
                            <Route path="/profile" element={<Profile />} />
                        </Route>
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
        </ThemeProvider>
    );
}

export default App;
