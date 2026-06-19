import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { isTokenValid, logout, getToken } from './utils/auth';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthRefresh } from './hooks/useAuthRefresh';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkOrderList from './pages/WorkOrderList';
import CreateWorkOrder from './pages/CreateWorkOrder';
import WorkOrderDetail from './pages/WorkOrderDetail';
import SystemPreferences from './pages/SystemPreferences';
import ManageStaff from './pages/ManageStaff';
import Inventory from './pages/Inventory';
import CreatePart from './pages/CreatePart';
import WorkshopRequirements from './pages/WorkshopRequirements';
import PurchaseRequests from './pages/PurchaseRequests';
import PurchaseRequestDetail from './pages/PurchaseRequestDetail';
import PurchaseOrders from './pages/PurchaseOrders';
import ServiceBills from './pages/ServiceBills';
import WorkshopInvoices from './pages/WorkshopInvoices';
import MaintenanceTracker from './pages/MaintenanceTracker';
import ScrapList from './pages/ScrapList';
import WriteOffList from './pages/WriteOffList';

function App() {
    useAuthRefresh();

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
                            <Route path="/inventory/create" element={<CreatePart />} />
                            <Route path="/inventory/edit/:id" element={<CreatePart />} />
                            <Route path="/requirements" element={<WorkshopRequirements />} />
                            <Route path="/purchase-requests" element={<PurchaseRequests />} />
                            <Route path="/purchase-requests/:id" element={<PurchaseRequestDetail />} />
                            <Route path="/purchase-orders" element={<PurchaseOrders />} />
                            <Route path="/scrap-list" element={<ScrapList />} />
                            <Route path="/write-offs" element={<WriteOffList />} />
                            <Route path="/service-bills" element={<ServiceBills />} />
                            <Route path="/workshop-invoices" element={<WorkshopInvoices />} />
                            <Route path="/maintenance-tracker" element={<MaintenanceTracker />} />
                            <Route path="/profile" element={<SystemPreferences />} />
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
