import { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
import { getUser, getUserId } from '../utils/auth';
import { changeStaffPassword } from '../services/authService';
import toast from 'react-hot-toast';

const Profile = () => {
    const user = getUser();
    const userId = getUserId();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPassword || !newPassword || !userId) return;

        setLoading(true);
        try {
            await changeStaffPassword(userId, { currentPassword, newPassword });
            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
        } catch {
            // handled by interceptor
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto space-y-6 animate-fadeInUp">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>Profile</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Manage your account</p>
            </div>

            {/* User Info Card */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4 mb-5">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: 'var(--brand-lime)', color: '#0A0A0A' }}
                    >
                        <User size={24} />
                    </div>
                    <div>
                        <p className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>
                            {(user?.fullName as string) || 'Workshop Staff'}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {(user?.email as string) || ''}
                        </p>
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Phone</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                            {(user?.phone as string) || 'N/A'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Role</span>
                        <span className="text-sm font-medium" style={{ color: 'var(--brand-lime)' }}>
                            Workshop Staff
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Status</span>
                        <span className="badge badge-green text-[10px]">
                            {(user?.status as string) || 'ACTIVE'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Lock size={18} style={{ color: 'var(--brand-lime)' }} />
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                        Change Password
                    </h2>
                </div>
                <form onSubmit={handleChangePassword} className="space-y-3">
                    <input
                        type="password"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input-field"
                        required
                    />
                    <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-field"
                        required
                        minLength={6}
                    />
                    <button
                        type="submit"
                        className="btn-primary w-full"
                        disabled={loading || !currentPassword || !newPassword}
                    >
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Updating…</>
                        ) : (
                            'Update Password'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Profile;
