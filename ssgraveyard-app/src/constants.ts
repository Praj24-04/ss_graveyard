import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure your Gemini API key in-app via the API Key button or set EXPO_PUBLIC_GEMINI_API_KEY
export const DEFAULT_GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

export const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

export const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';

export const FALLBACK_GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

export const LEGACY_GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

const API_KEY_STORAGE = 'custom_gemini_api_key';
const WORKING_MODEL_STORAGE = 'custom_gemini_working_model';

export async function getActiveApiKey(): Promise<string> {
  try {
    const customKey = await AsyncStorage.getItem(API_KEY_STORAGE);
    if (customKey && customKey.trim().length > 10) {
      return customKey.trim();
    }
  } catch {
    // ignore
  }
  return DEFAULT_GEMINI_API_KEY;
}

export async function saveCustomApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key.trim());
}

export async function getWorkingGeminiUrl(): Promise<string> {
  try {
    const model = await AsyncStorage.getItem(WORKING_MODEL_STORAGE);
    if (model) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    }
  } catch {
    // ignore
  }
  return GEMINI_API_URL;
}

export async function verifyApiKey(key: string): Promise<{ success: boolean; message: string; model?: string }> {
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      return { success: false, message: 'API key is empty.' };
    }

    let lastError = 'Failed to connect to Google Gemini API.';

    // Test candidate models, prioritizing gemini-3.8-flash as recommended by Google
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmed}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello' }] }],
          }),
        });

        const data = await res.json();
        if (res.ok) {
          await AsyncStorage.setItem(WORKING_MODEL_STORAGE, model);
          return {
            success: true,
            message: `Valid API Key! Connected with ${model}.`,
            model,
          };
        } else {
          const apiMessage = data?.error?.message;
          if (apiMessage) {
            lastError = apiMessage;
          }
          // If the key itself is invalid or unauthorized, don't keep polling other models
          if (data?.error?.status === 'INVALID_ARGUMENT' && apiMessage?.toLowerCase().includes('api key')) {
            return { success: false, message: apiMessage };
          }
        }
      } catch (reqErr: any) {
        lastError = reqErr?.message ?? lastError;
      }
    }

    return { success: false, message: lastError };
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'Network error connecting to Gemini.' };
  }
}
