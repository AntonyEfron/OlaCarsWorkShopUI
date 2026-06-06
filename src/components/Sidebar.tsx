import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    ClipboardList,
    User,
    LogOut,
    Wrench,
    Users,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Package,
    Receipt,
    Trash2,
} from 'lucide-react';
import { logout, getUser, getUserRole } from '../utils/auth';

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

interface SubItem {
    path: string;
    label: string;
}

interface NavItem {
    label: string;
    icon: any;
    path?: string;
    subItems?: SubItem[];
}

const Sidebar = ({ isCollapsed, onToggle }: SidebarProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const user = getUser();
    const displayName = (user?.fullName as string) || 'Workshop Staff';

    const role = getUserRole();
    const isManager = role === 'workshopmanager';

    const baseNavItems: NavItem[] = [
        { path: '/dashboard', icon: LayoutDashboard, label: t('common.dashboard') },
        {
            label: t('common.workOrders'),
            icon: ClipboardList,
            subItems: [
                { path: '/work-orders', label: 'All Work Orders' },
                { path: '/work-orders/create', label: t('workOrders.list.new') },
            ],
        },
        {
            label: 'Inventory',
            icon: Package,
            subItems: [
                { path: '/inventory', label: 'Inventory Stock' },
                { path: '/requirements', label: 'Part Requirements' },
                { path: '/purchase-requests', label: 'Purchase Requests' },
                { path: '/write-offs', label: 'Write Offs' },
            ],
        },
        {
            label: 'Bills & Invoices',
            icon: Receipt,
            subItems: [
                { path: '/service-bills', label: 'Service Bills' },
                { path: '/workshop-invoices', label: 'Driver Invoices' },
            ],
        },
        {
            label: 'Scrap Management',
            icon: Trash2,
            subItems: [
                { path: '/scrap-list', label: 'Scrap List' },
            ],
        },
        {
            path: '/maintenance-tracker',
            icon: Wrench,
            label: 'Maintenance Tracker',
        },
    ];

    if (isManager) {
        baseNavItems.push({ path: '/manage-staff', icon: Users, label: t('manageStaff.title', 'Manage Staff') });
    }

    baseNavItems.push({ path: '/profile', icon: User, label: 'System Preferences' });

    // Determine if a parent is currently active based on current pathname
    const isParentActive = (item: NavItem) => {
        if (item.path) {
            return location.pathname === item.path;
        }
        if (item.subItems) {
            return item.subItems.some(sub => location.pathname === sub.path);
        }
        return false;
    };

    // State to track which submenus are expanded
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        baseNavItems.forEach(item => {
            if (item.subItems && item.subItems.some(sub => location.pathname === sub.path)) {
                initial[item.label] = true;
            }
        });
        return initial;
    });

    // Auto-expand menu when pathname changes
    useEffect(() => {
        baseNavItems.forEach(item => {
            if (item.subItems && item.subItems.some(sub => location.pathname === sub.path)) {
                setExpandedMenus(prev => ({ ...prev, [item.label]: true }));
            }
        });
    }, [location.pathname]);

    const toggleMenu = (menuLabel: string) => {
        setExpandedMenus(prev => ({
            ...prev,
            [menuLabel]: !prev[menuLabel]
        }));
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className="h-full flex flex-col transition-all duration-300 relative select-none"
            style={{
                width: isCollapsed ? '72px' : '260px',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-main)',
            }}
        >
            {/* Logo Header */}
            <div className="h-20 flex items-center border-b border-[var(--border-main)] px-6 justify-between flex-shrink-0" style={{ borderColor: 'var(--border-main)' }}>
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center border-2 border-[#D4F12E] overflow-hidden flex-shrink-0">
                        <div className="bg-black w-[22px] h-[22px] rounded-full flex items-center justify-center">
                            <div className="bg-[#D4F12E] w-2.5 h-2.5 rounded-full"></div>
                        </div>
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col border-l border-[var(--border-main)] pl-3 ml-1 h-8 justify-center" style={{ borderColor: 'var(--border-main)' }}>
                            <span className="text-[var(--text-main)] font-bold tracking-widest text-[14px] uppercase whitespace-nowrap leading-none">Ola Cars</span>
                            <span className="text-[var(--sidebar-active)] font-semibold tracking-widest text-[9px] uppercase whitespace-nowrap mt-0.5 leading-none">Workshop</span>
                        </div>
                    )}
                </div>
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
                {baseNavItems.map((item) => {
                    const hasSubItems = !!item.subItems && item.subItems.length > 0;
                    const isExpanded = !!expandedMenus[item.label];
                    const isActive = isParentActive(item);

                    if (!hasSubItems) {
                        // Single link rendering
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path!}
                                end={item.path === '/dashboard'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                        isActive ? 'text-brand-black' : ''
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
                        );
                    }

                    // Multi-link accordion rendering
                    return (
                        <div key={item.label} className="space-y-1">
                            <button
                                onClick={() => toggleMenu(item.label)}
                                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                                    isActive && !isExpanded ? 'bg-[var(--brand-lime-alpha)] text-[var(--brand-lime)]' : 'text-[var(--sidebar-text)] hover:bg-white/5'
                                }`}
                                style={{ minHeight: '44px', border: 'none', background: 'transparent' }}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon size={20} className="flex-shrink-0" />
                                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                                </div>
                                {!isCollapsed && (
                                    <div className="text-[var(--text-muted)]">
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </div>
                                )}
                            </button>

                            {/* Sub items list with line connector */}
                            {isExpanded && !isCollapsed && (
                                <div className="ml-5 pl-3 border-l border-[var(--border-main)]/40 space-y-1 py-1 animate-fadeIn">
                                    {item.subItems!.map((sub) => (
                                        <NavLink
                                            key={sub.path}
                                            to={sub.path}
                                            className={({ isActive }) =>
                                                `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                                    isActive
                                                        ? 'text-[var(--brand-lime)] bg-white/5'
                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                                                }`
                                            }
                                        >
                                            <span className="truncate">{sub.label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
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
                    background: 'var(--sidebar-active)',
                    color: 'var(--brand-black)',
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
