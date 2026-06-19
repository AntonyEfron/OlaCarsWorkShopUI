import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

const DashboardLayout = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const toggleMobileSidebar = () => {
        setIsMobileOpen(!isMobileOpen);
    };

    return (
        <div
            className="flex h-screen overflow-hidden transition-colors duration-300"
            style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}
        >
            {/* Desktop Sidebar */}
            <div
                className={`hidden lg:block flex-shrink-0 transition-all duration-300`}
                style={{ width: isSidebarCollapsed ? '72px' : '260px' }}
            >
                <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                        onClick={toggleMobileSidebar}
                    />
                    <div className="fixed inset-y-0 left-0 z-50 lg:hidden" style={{ width: '260px' }}>
                        <Sidebar isCollapsed={false} onToggle={toggleMobileSidebar} />
                    </div>
                </>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden w-full">
                <TopBar onMenuClick={toggleMobileSidebar} />
                <main className="flex-1 overflow-y-auto p-4 lg:p-6 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
