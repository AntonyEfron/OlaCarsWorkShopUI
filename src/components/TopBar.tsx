import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from './LanguageSwitcher';

interface TopBarProps {
    onMenuClick: () => void;
}

const TopBar = ({ onMenuClick }: TopBarProps) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <header
            className="h-16 flex items-center justify-between px-4 lg:px-6 border-b flex-shrink-0"
            style={{
                background: 'var(--bg-topbar)',
                borderColor: 'var(--border-main)',
            }}
        >
            {/* Hamburger for mobile/tablet */}
            <button
                onClick={onMenuClick}
                className="btn-icon lg:hidden"
                id="topbar-menu-toggle"
            >
                <Menu size={20} />
            </button>

            <div className="flex-1" />

            {/* Right-side actions */}
            <div className="flex items-center gap-4">
                {/* Language Switcher */}
                <LanguageSwitcher />

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className="btn-icon"
                    id="topbar-theme-toggle"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>
        </header>
    );
};

export default TopBar;
