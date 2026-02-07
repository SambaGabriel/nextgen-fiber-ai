/**
 * PreferencesTab - User preferences section
 * Language, theme, timezone, date format
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Settings, Globe, Sun, Moon, Monitor, Clock, Calendar,
    CheckCircle, Loader2, ChevronDown, Search
} from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { preferencesService } from '../../../services/settingsService';
import { UserPreferences, SupportedLanguage, Theme, DateFormat, COMMON_TIMEZONES } from '../../../types/settings';

interface PreferencesTabProps {
    user: User;
    lang: Language;
}

const PreferencesTab: React.FC<PreferencesTabProps> = ({ user, lang }) => {
    const t = translations[lang];

    // Preferences state
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // UI state
    const [isLanguageOpen, setIsLanguageOpen] = useState(false);
    const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);
    const [timezoneSearch, setTimezoneSearch] = useState('');

    // Language options
    const languageOptions: Array<{ value: SupportedLanguage; label: string; flag: string }> = [
        { value: 'en', label: 'English', flag: '🇺🇸' },
        { value: 'pt-br', label: 'Português (Brasil)', flag: '🇧🇷' },
        { value: 'es', label: 'Español', flag: '🇪🇸' }
    ];

    // Theme options
    const themeOptions: Array<{ value: Theme; label: string; icon: React.ElementType }> = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Monitor }
    ];

    // Date format options
    const dateFormatOptions: Array<{ value: DateFormat; label: string; example: string }> = [
        { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '02/07/2026' },
        { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '07/02/2026' }
    ];

    // Load preferences
    useEffect(() => {
        const loadPreferences = async () => {
            setIsLoading(true);
            try {
                const prefs = await preferencesService.getPreferences();
                setPreferences(prefs);
            } catch (error) {
                console.error('[PreferencesTab] Error loading preferences:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadPreferences();
    }, []);

    // Save preference with debounce
    const savePreference = useCallback(async (key: string, value: any) => {
        if (!preferences) return;

        setIsSaving(true);
        setSaveSuccess(false);

        try {
            await preferencesService.updatePreferences({ [key]: value });
            setPreferences(prev => prev ? { ...prev, [key]: value } : prev);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        } catch (error) {
            console.error('[PreferencesTab] Error saving preference:', error);
        } finally {
            setIsSaving(false);
        }
    }, [preferences]);

    // Handle language change
    const handleLanguageChange = useCallback((value: SupportedLanguage) => {
        savePreference('language', value);
        setIsLanguageOpen(false);
    }, [savePreference]);

    // Handle theme change
    const handleThemeChange = useCallback((value: Theme) => {
        savePreference('theme', value);
    }, [savePreference]);

    // Handle timezone change
    const handleTimezoneChange = useCallback((value: string) => {
        savePreference('timezone', value);
        setIsTimezoneOpen(false);
        setTimezoneSearch('');
    }, [savePreference]);

    // Handle date format change
    const handleDateFormatChange = useCallback((value: DateFormat) => {
        savePreference('dateFormat', value);
    }, [savePreference]);

    // Filter timezones by search
    const filteredTimezones = COMMON_TIMEZONES.filter(tz =>
        tz.label.toLowerCase().includes(timezoneSearch.toLowerCase()) ||
        tz.value.toLowerCase().includes(timezoneSearch.toLowerCase())
    );

    // Get current selections
    const currentLanguage = languageOptions.find(l => l.value === preferences?.language) || languageOptions[0];
    const currentTimezone = COMMON_TIMEZONES.find(tz => tz.value === preferences?.timezone) || COMMON_TIMEZONES[0];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                        <Settings className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            {(t as any).preferences || 'Preferences'}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {(t as any).preferences_desc || 'Customize your experience'}
                        </p>
                    </div>
                </div>
                {/* Save indicator */}
                {(isSaving || saveSuccess) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--elevated)' }}>
                        {isSaving ? (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--neural-core)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Saving...</span>
                            </>
                        ) : saveSuccess ? (
                            <>
                                <CheckCircle className="w-3 h-3" style={{ color: 'var(--online-core)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--online-core)' }}>Saved</span>
                            </>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Language */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).language || 'Language'}
                    </h3>
                </div>
                <div className="relative max-w-sm">
                    <button
                        onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)'
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{currentLanguage.flag}</span>
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{currentLanguage.label}</span>
                        </div>
                        <ChevronDown
                            className="w-4 h-4 transition-transform"
                            style={{
                                color: 'var(--text-tertiary)',
                                transform: isLanguageOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                        />
                    </button>
                    {isLanguageOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsLanguageOpen(false)} />
                            <div
                                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
                                style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border-default)',
                                    boxShadow: 'var(--shadow-float)'
                                }}
                            >
                                {languageOptions.map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleLanguageChange(option.value)}
                                        className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                                        style={{
                                            background: preferences?.language === option.value ? 'var(--neural-dim)' : 'transparent'
                                        }}
                                    >
                                        <span className="text-lg">{option.flag}</span>
                                        <span
                                            className="font-medium"
                                            style={{
                                                color: preferences?.language === option.value
                                                    ? 'var(--neural-core)'
                                                    : 'var(--text-primary)'
                                            }}
                                        >
                                            {option.label}
                                        </span>
                                        {preferences?.language === option.value && (
                                            <CheckCircle className="w-4 h-4 ml-auto" style={{ color: 'var(--neural-core)' }} />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Theme */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Sun className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).theme || 'Theme'}
                    </h3>
                </div>
                <div className="flex gap-3">
                    {themeOptions.map(option => {
                        const Icon = option.icon;
                        const isSelected = preferences?.theme === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => handleThemeChange(option.value)}
                                className="flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-xl transition-all"
                                style={{
                                    background: isSelected ? 'var(--neural-dim)' : 'var(--elevated)',
                                    border: isSelected ? '2px solid var(--neural-core)' : '2px solid transparent'
                                }}
                            >
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{
                                        background: isSelected ? 'var(--neural-core)' : 'var(--deep)'
                                    }}
                                >
                                    <Icon
                                        className="w-5 h-5"
                                        style={{ color: isSelected ? '#ffffff' : 'var(--text-tertiary)' }}
                                    />
                                </div>
                                <span
                                    className="text-sm font-semibold"
                                    style={{
                                        color: isSelected ? 'var(--neural-core)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {option.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Timezone */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).timezone || 'Timezone'}
                    </h3>
                </div>
                <div className="relative max-w-sm">
                    <button
                        onClick={() => setIsTimezoneOpen(!isTimezoneOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)'
                        }}
                    >
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{currentTimezone.label}</span>
                        <ChevronDown
                            className="w-4 h-4 transition-transform"
                            style={{
                                color: 'var(--text-tertiary)',
                                transform: isTimezoneOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}
                        />
                    </button>
                    {isTimezoneOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => { setIsTimezoneOpen(false); setTimezoneSearch(''); }} />
                            <div
                                className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
                                style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border-default)',
                                    boxShadow: 'var(--shadow-float)'
                                }}
                            >
                                {/* Search */}
                                <div className="p-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
                                        <input
                                            type="text"
                                            value={timezoneSearch}
                                            onChange={(e) => setTimezoneSearch(e.target.value)}
                                            placeholder="Search timezone..."
                                            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none"
                                            style={{
                                                background: 'var(--elevated)',
                                                color: 'var(--text-primary)'
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                {/* Options */}
                                <div className="max-h-60 overflow-y-auto">
                                    {filteredTimezones.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleTimezoneChange(option.value)}
                                            className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                                            style={{
                                                background: preferences?.timezone === option.value ? 'var(--neural-dim)' : 'transparent'
                                            }}
                                        >
                                            <span
                                                className="font-medium"
                                                style={{
                                                    color: preferences?.timezone === option.value
                                                        ? 'var(--neural-core)'
                                                        : 'var(--text-primary)'
                                                }}
                                            >
                                                {option.label}
                                            </span>
                                            {preferences?.timezone === option.value && (
                                                <CheckCircle className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                                            )}
                                        </button>
                                    ))}
                                    {filteredTimezones.length === 0 && (
                                        <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                            No timezones found
                                        </p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Date Format */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).date_format || 'Date Format'}
                    </h3>
                </div>
                <div className="flex gap-3 max-w-md">
                    {dateFormatOptions.map(option => {
                        const isSelected = preferences?.dateFormat === option.value;
                        return (
                            <button
                                key={option.value}
                                onClick={() => handleDateFormatChange(option.value)}
                                className="flex-1 flex flex-col items-center gap-1 px-4 py-4 rounded-xl transition-all"
                                style={{
                                    background: isSelected ? 'var(--neural-dim)' : 'var(--elevated)',
                                    border: isSelected ? '2px solid var(--neural-core)' : '2px solid transparent'
                                }}
                            >
                                <span
                                    className="text-sm font-bold"
                                    style={{
                                        color: isSelected ? 'var(--neural-core)' : 'var(--text-primary)'
                                    }}
                                >
                                    {option.label}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                    {option.example}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PreferencesTab;
