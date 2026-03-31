import { Navigate, Outlet } from 'react-router-dom';
import { isTokenValid } from '../utils/auth';

const ProtectedRoute = () => {
    const isAuthenticated = isTokenValid();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
