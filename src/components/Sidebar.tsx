import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    ClipboardList,
    PlusCircle,
    User,
    LogOut,
    Wrench,
    Users,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { logout, getUser, getUserRole } from '../utils/auth';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

const Sidebar = ({ isCollapsed, onToggle }: SidebarProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = getUser();
    const displayName = (user?.fullName as string) || 'Workshop Staff';

    const role = getUserRole();
    const isManager = role === 'workshopmanager';

    const baseNavItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: t('common.dashboard') },
        { path: '/work-orders', icon: ClipboardList, label: t('common.workOrders') },
        { path: '/work-orders/create', icon: PlusCircle, label: t('workOrders.list.new') },
    ];

    if (isManager) {
        baseNavItems.push({ path: '/manage-staff', icon: Users, label: t('manageStaff.title', 'Manage Staff') });
    }

    baseNavItems.push({ path: '/profile', icon: User, label: t('common.profile') });

    const navItems = baseNavItems;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className="h-full flex flex-col transition-all duration-300 relative"
            style={{
                width: isCollapsed ? '72px' : '260px',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-main)',
            }}
        >
            {/* Logo / Brand */}
            <div className="flex items-center gap-3 px-4 h-16 border-b" style={{ borderColor: 'var(--border-main)' }}>
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--brand-lime)' }}
                >
                    <Wrench size={18} color="#0A0A0A" strokeWidth={2.5} />
                </div>
                {!isCollapsed && (
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }}>
                            OlaCars
                        </p>
                        <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--brand-lime)' }}>
                            Workshop
                        </p>
                    </div>
                )}
            </div>

            {/* User Info */}
            {!isCollapsed && (
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-main)' }}>
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-main)' }}>
                        {displayName}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {isManager ? 'Workshop Manager' : 'Technician'}
                    </p>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/dashboard'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                isActive
                                    ? 'text-brand-black'
                                    : ''
                            }`
                        }
                        style={({ isActive }) => ({
                            background: isActive ? 'var(--brand-lime)' : 'transparent',
                            color: isActive ? '#0A0A0A' : 'var(--sidebar-text)',
                            minHeight: '44px',
                        })}
                    >
                        <item.icon size={20} className="flex-shrink-0" />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div className="px-2 py-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full transition-all duration-200 cursor-pointer"
                    style={{
                        color: 'var(--alert-red)',
                        background: 'transparent',
                        border: 'none',
                        minHeight: '44px',
                    }}
                >
                    <LogOut size={20} className="flex-shrink-0" />
                    {!isCollapsed && <span>{t('common.logout')}</span>}
                </button>
            </div>

            {/* Collapse Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer z-10 transition-all duration-200 hover:scale-110"
                style={{
                    background: 'var(--brand-lime)',
                    color: '#0A0A0A',
                    border: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
            >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </aside>
    );
};

export default Sidebar;
