import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

interface Language {
    code: string;
    label: string;
    flag: string;
}

const languages: Language[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

    const handleSelect = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer hover:bg-white/5 bg-[#00000033] backdrop-blur-md"
                style={{ border: '1px solid var(--border-main)' }}
                title="Switch Language"
                id="language-switcher-btn"
            >
                <span className="text-lg leading-none">{currentLang.flag}</span>
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-main)' }}>
                    {currentLang.code}
                </span>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--text-dim)' }}
                />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-40 rounded-xl overflow-hidden shadow-2xl z-50 animate-fadeInUp"
                    style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-main)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleSelect(lang.code)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
                                lang.code === currentLang.code
                                    ? 'bg-lime/10'
                                    : 'hover:bg-white/5'
                            }`}
                            style={{
                                color: lang.code === currentLang.code ? 'var(--brand-lime)' : 'var(--text-main)',
                            }}
                            id={`lang-option-${lang.code}`}
                        >
                            <span className="text-lg leading-none">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {lang.code === currentLang.code && (
                                <span className="ml-auto text-xs" style={{ color: 'var(--brand-lime)' }}>✓</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
