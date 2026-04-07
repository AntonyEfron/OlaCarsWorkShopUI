import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Eye, EyeOff, Loader2, Sun, Moon } from 'lucide-react';
import { workshopStaffLogin, workshopManagerLogin } from '../services/authService';
import { setToken, setUser } from '../utils/auth';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import loginVideo from '../assets/loginbgvideo.mp4';

const Login = () => {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loginRole, setLoginRole] = useState<'staff' | 'manager'>('staff');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLoading(true);
        try {
            const data = loginRole === 'manager' 
                ? await workshopManagerLogin({ email, password })
                : await workshopStaffLogin({ email, password });
            
            setToken(data.token);
            if (data.manager) {
                setUser(data.manager);
            } else if (data.staff) {
                setUser(data.staff);
            } else if (data.data) {
                setUser(data.data);
            }
            navigate('/dashboard', { replace: true });
        } catch {
            // Toast handled by interceptor
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black">
            {/* Background Video */}
            <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-50 transition-opacity duration-1000"
                style={{ filter: 'brightness(0.4) saturate(1.2)' }}
            >
                <source src={loginVideo} type="video/mp4" />
            </video>

            {/* Top Right Actions */}
            <div className="absolute top-6 right-6 flex items-center gap-4 z-50 animate-fadeInRight">
                <LanguageSwitcher />
                <button
                    onClick={toggleTheme}
                    className="flex items-center justify-center p-2 rounded-xl transition-all duration-300 cursor-pointer text-gray-400 hover:text-lime bg-[#00000033] backdrop-blur-md"
                    style={{ border: '1px solid var(--border-main)' }}
                    title={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>

            {/* Background decorative elements */}
            <div
                className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.1] pointer-events-none z-0"
                style={{ background: 'var(--brand-lime)', filter: 'blur(150px)' }}
            />

            <div className="w-full max-w-md relative z-10 animate-fadeInUp">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{
                            background: 'var(--brand-lime)',
                            boxShadow: '0 0 50px rgba(200, 230, 0, 0.3)',
                        }}
                    >
                        <Wrench size={28} color="#0A0A0A" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-3xl font-bold mb-1 tracking-tight" style={{ color: '#FFFFFF' }}>
                        {t('common.workOrders')}
                    </h1>
                    <p className="text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        OlaCars — {t('dashboard.subtitle')}
                    </p>
                </div>

                {/* Login Card */}
                <div className="glass-card p-8 backdrop-blur-2xl bg-[#00000044] rounded-2xl" style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    
                    {/* Role Toggle */}
                    <div className="flex bg-[#00000066] p-1.5 rounded-xl mb-8 border border-white/5 relative">
                        {/* Animated pill background */}
                        <div 
                            className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-lg transition-all duration-300 ease-in-out shadow-lg"
                            style={{ 
                                left: loginRole === 'staff' ? '6px' : 'calc(50%)',
                                background: loginRole === 'staff' ? 'var(--brand-lime)' : '#10b981'
                            }}
                        />
                        
                        <button
                            type="button"
                            onClick={() => setLoginRole('staff')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 ${
                                loginRole === 'staff' ? 'text-black' : 'text-white/40 hover:text-white'
                            }`}
                        >
                            Staff
                        </button>
                        <button
                            type="button"
                            onClick={() => setLoginRole('manager')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 relative z-10 ${
                                loginRole === 'manager' ? 'text-white' : 'text-white/40 hover:text-white'
                            }`}
                        >
                            Manager
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5 flex flex-col items-stretch">
                        <div>
                            <label
                                className="block text-xs font-bold uppercase tracking-widest mb-2"
                                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                            >
                                {t('common.logout').includes('Sesión') ? 'Correo Electrónico' : 'Email Address'}
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@olacars.com"
                                className="input-field bg-white/5 border-white/10 text-white focus:border-lime/50"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div>
                            <label
                                className="block text-xs font-bold uppercase tracking-widest mb-2"
                                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                            >
                                {t('common.logout').includes('Sesión') ? 'Contraseña' : 'Password'}
                            </label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input-field pr-12 bg-white/5 border-white/10 text-white focus:border-lime/50"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer outline-none"
                                    style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.3)' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-primary w-full mt-2 h-12 text-sm font-bold tracking-wide"
                            id="login-submit"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>{t('common.loading')}</span>
                                </div>
                            ) : (
                                t('common.logout').includes('Sesión') ? 'Iniciar Sesión' : 'Sign In'
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs mt-8 font-medium" style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                    {t('common.logout').includes('Sesión') 
                        ? 'Acceso exclusivo para personal del taller. Contacte a su supervisor.' 
                        : 'Workshop System access. Contact your management if you need help.'}
                </p>
            </div>
        </div>
    );
};

export default Login;
