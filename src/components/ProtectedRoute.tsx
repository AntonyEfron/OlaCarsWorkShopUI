import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isTokenValid } from '../utils/auth';

const ProtectedRoute = () => {
    const isAuthenticated = isTokenValid();
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
