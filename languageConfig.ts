export type LanguageId =
    | 'auto'
    | 'en'
    | 'hi'
    | 'kn'
    | 'ta'
    | 'te'
    | 'ml'
    | 'mr'
    | 'bn'
    | 'gu'
    | 'pa'
    | 'or'
    | 'ur';

export interface LanguageOption {
    id: LanguageId;
    displayName: string;
    nativeName: string;
    instruction: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { id: 'auto', displayName: 'Auto Detect', nativeName: 'Auto Detect', instruction: 'Detect the user\'s spoken or written language and respond in the same language when supported.' },
    { id: 'en', displayName: 'English', nativeName: 'English', instruction: 'Respond in English unless the user explicitly asks to switch languages.' },
    { id: 'hi', displayName: 'Hindi', nativeName: 'हिन्दी', instruction: 'Respond in Hindi (हिन्दी) unless the user explicitly asks to switch languages.' },
    { id: 'kn', displayName: 'Kannada', nativeName: 'ಕನ್ನಡ', instruction: 'Respond in Kannada (ಕನ್ನಡ) unless the user explicitly asks to switch languages.' },
    { id: 'ta', displayName: 'Tamil', nativeName: 'தமிழ்', instruction: 'Respond in Tamil (தமிழ்) unless the user explicitly asks to switch languages.' },
    { id: 'te', displayName: 'Telugu', nativeName: 'తెలుగు', instruction: 'Respond in Telugu (తెలుగు) unless the user explicitly asks to switch languages.' },
    { id: 'ml', displayName: 'Malayalam', nativeName: 'മലയാളം', instruction: 'Respond in Malayalam (മലയാളം) unless the user explicitly asks to switch languages.' },
    { id: 'mr', displayName: 'Marathi', nativeName: 'मराठी', instruction: 'Respond in Marathi (मराठी) unless the user explicitly asks to switch languages.' },
    { id: 'bn', displayName: 'Bengali', nativeName: 'বাংলা', instruction: 'Respond in Bengali (বাংলা) unless the user explicitly asks to switch languages.' },
    { id: 'gu', displayName: 'Gujarati', nativeName: 'ગુજરાતી', instruction: 'Respond in Gujarati (ગુજરાતી) unless the user explicitly asks to switch languages.' },
    { id: 'pa', displayName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', instruction: 'Respond in Punjabi (ਪੰਜਾਬੀ) unless the user explicitly asks to switch languages.' },
    { id: 'or', displayName: 'Odia', nativeName: 'ଓଡ଼ିଆ', instruction: 'Respond in Odia (ଓଡ଼ିଆ) unless the user explicitly asks to switch languages.' },
    { id: 'ur', displayName: 'Urdu', nativeName: 'اردو', instruction: 'Respond in Urdu (اردو) unless the user explicitly asks to switch languages.' }
];

export function getLanguageOption(languageId: unknown): LanguageOption {
    return LANGUAGE_OPTIONS.find((option) => option.id === languageId) || LANGUAGE_OPTIONS[0];
}
