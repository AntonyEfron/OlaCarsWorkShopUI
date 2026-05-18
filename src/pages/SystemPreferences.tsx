import React, { useState, useEffect } from 'react';
import { User, Lock, Loader2, Sun, Moon, Sliders, Check, ShieldAlert, KeyRound } from 'lucide-react';
import { getUser, getUserId, getUserRole } from '../utils/auth';
import { changeStaffPassword } from '../services/authService';
import { getHourlyLabourRate, updateHourlyLabourRate } from '../services/workOrderService';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

type Tab = 'profile' | 'appearance' | 'system';

const SystemPreferences = () => {
    const user = getUser();
    const userId = getUserId();
    const role = getUserRole();
    const { theme, toggleTheme } = useTheme();

    const isManager = role === 'workshopmanager' || role === 'branchmanager' || role === 'admin';

    // Tabs state
    const [activeTab, setActiveTab] = useState<Tab>('profile');

    // Profile password states
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loadingPassword, setLoadingPassword] = useState(false);

    // System settings states
    const [labourRate, setLabourRate] = useState<number>(150);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        if (activeTab === 'system' && isManager) {
            loadSystemSettings();
        }
    }, [activeTab]);

    const loadSystemSettings = async () => {
        setLoadingSettings(true);
        try {
            const rate = await getHourlyLabourRate();
            setLabourRate(rate);
        } catch {
            // Handled
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !userId) return;

        setLoadingPassword(true);
        try {
            await changeStaffPassword(userId, { currentPassword, newPassword });
            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
        } catch {
            // Handled by interceptor
        } finally {
            setLoadingPassword(false);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isManager) {
            toast.error('Only managers can update system settings.');
            return;
        }

        setSavingSettings(true);
        try {
            await updateHourlyLabourRate(labourRate);
            toast.success('System labor rate updated successfully');
        } catch {
            // Handled
        } finally {
            setSavingSettings(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeInUp">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                    System Preferences
                </h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Configure user profile, visual themes, and workshop charge rates.
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex p-1 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-main)]/40">
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                        activeTab === 'profile'
                            ? 'bg-[var(--brand-lime)] text-black shadow-lg shadow-black/10'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                >
                    <User size={16} />
                    Profile & Security
                </button>
                <button
                    onClick={() => setActiveTab('appearance')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                        activeTab === 'appearance'
                            ? 'bg-[var(--brand-lime)] text-black shadow-lg shadow-black/10'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                >
                    <Sun size={16} />
                    Appearance
                </button>
                <button
                    onClick={() => setActiveTab('system')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                        activeTab === 'system'
                            ? 'bg-[var(--brand-lime)] text-black shadow-lg shadow-black/10'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                >
                    <Sliders size={16} />
                    System Settings
                </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-6">
                {/* 1. Profile & Security Tab */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        {/* Profile Info */}
                        <div className="glass-card p-6 space-y-4">
                            <div className="flex items-center gap-4 pb-4 border-b border-[var(--border-main)]/35">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'var(--brand-lime)', color: '#0A0A0A' }}
                                >
                                    <User size={26} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-lg font-bold truncate" style={{ color: 'var(--text-main)' }}>
                                        {(user?.fullName as string) || 'Workshop Staff'}
                                    </p>
                                    <p className="text-xs font-mono uppercase tracking-wider text-[var(--brand-lime)]">
                                        {isManager ? 'Workshop Manager' : 'Workshop Technician'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>Email Address</span>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                                        {(user?.email as string) || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>Phone Number</span>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                                        {(user?.phone as string) || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>Security Role</span>
                                    <p className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-main)' }}>
                                        {role || 'N/A'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>Status</span>
                                    <div>
                                        <span className="badge badge-green text-[10px] font-bold tracking-wide uppercase px-2 py-0.5">
                                            {(user?.status as string) || 'ACTIVE'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Password Settings */}
                        <div className="glass-card p-6 space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-main)]/35">
                                <KeyRound size={18} className="text-[var(--brand-lime)]" />
                                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-main)' }}>
                                    Change Security Password
                                </h3>
                            </div>
                            <form onSubmit={handleChangePassword} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="Enter current password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="input-field"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="Enter new password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="input-field"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="btn-primary w-full"
                                    disabled={loadingPassword || !currentPassword || !newPassword}
                                >
                                    {loadingPassword ? (
                                        <><Loader2 size={16} className="animate-spin" /> Updating Password…</>
                                    ) : (
                                        'Update Security Password'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* 2. Appearance Tab */}
                {activeTab === 'appearance' && (
                    <div className="glass-card p-6 space-y-6">
                        <div>
                            <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                                Interface Theme & Appearance
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Pick your preferred color scheme for the dashboard.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Light Mode Selector Card */}
                            <button
                                onClick={() => theme === 'dark' && toggleTheme()}
                                className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                                    theme === 'light'
                                        ? 'border-[var(--brand-lime)] bg-[var(--brand-lime-alpha)] shadow-lg'
                                        : 'border-[var(--border-main)] bg-[var(--bg-input)] opacity-60 hover:opacity-90'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500">
                                        <Sun size={20} />
                                    </div>
                                    {theme === 'light' && (
                                        <div className="w-5 h-5 rounded-full bg-[var(--brand-lime)] text-black flex items-center justify-center">
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-main)' }}>Light Mode</h4>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Clean, bright workspace theme</p>
                            </button>

                            {/* Dark Mode Selector Card */}
                            <button
                                onClick={() => theme === 'light' && toggleTheme()}
                                className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                                    theme === 'dark'
                                        ? 'border-[var(--brand-lime)] bg-[var(--brand-lime-alpha)] shadow-lg'
                                        : 'border-[var(--border-main)] bg-[var(--bg-input)] opacity-60 hover:opacity-90'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                                        <Moon size={20} />
                                    </div>
                                    {theme === 'dark' && (
                                        <div className="w-5 h-5 rounded-full bg-[var(--brand-lime)] text-black flex items-center justify-center">
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-main)' }}>Dark Mode</h4>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Midnight dark UI workspace theme</p>
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. System Preferences Tab */}
                {activeTab === 'system' && (
                    <div className="glass-card p-6 space-y-6">
                        <div>
                            <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>
                                Workshop System Configuration
                            </h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Manage global workshop constants and financial settings.
                            </p>
                        </div>

                        {!isManager ? (
                            <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col items-center text-center space-y-3">
                                <div className="p-3 rounded-full bg-red-500/10 text-red-500 animate-pulse">
                                    <ShieldAlert size={28} />
                                </div>
                                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wide">Access Restricted</h4>
                                <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                                    Only Workshop Managers or Branch Admins are authorized to view and edit system-wide billing settings. Please contact your administrator.
                                </p>
                            </div>
                        ) : loadingSettings ? (
                            <div className="p-12 text-center space-y-3">
                                <Loader2 size={32} className="animate-spin mx-auto text-[var(--brand-lime)]" />
                                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                    Fetching Preference Value...
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveSettings} className="space-y-5">
                                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[var(--brand-lime)]">
                                            Per Hour Labor Charge Setting
                                        </label>
                                        <div className="relative flex items-center">
                                            <span className="absolute left-3.5 text-sm font-semibold opacity-40">$</span>
                                            <input
                                                type="number"
                                                value={labourRate}
                                                onChange={(e) => setLabourRate(Math.max(1, Number(e.target.value)))}
                                                placeholder="150"
                                                className="input-field pl-8 font-mono font-bold"
                                                min="1"
                                                required
                                            />
                                        </div>
                                        <p className="text-[10px] mt-2 opacity-50">
                                            * This rate dynamically controls the automatic estimates on **Work Order Creation** and pre-populates the default hourly rate during **Work Order Service Bill Generation**.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn-primary w-full"
                                    disabled={savingSettings}
                                >
                                    {savingSettings ? (
                                        <><Loader2 size={16} className="animate-spin" /> Saving System Setting…</>
                                    ) : (
                                        'Save Preferences'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SystemPreferences;
