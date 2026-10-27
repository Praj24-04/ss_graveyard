import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { getActiveApiKey, saveCustomApiKey, verifyApiKey } from '../constants';

interface ApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onKeySaved?: () => void;
}

export function ApiKeyModal({ visible, onClose, onKeySaved }: ApiKeyModalProps) {
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      (async () => {
        const current = await getActiveApiKey();
        setKey(current);
        setStatusMessage(null);
      })();
    }
  }, [visible]);

  const handleTestAndSave = async () => {
    if (!key.trim()) {
      setStatusMessage({ text: 'Please enter a Gemini API key.', success: false });
      return;
    }

    setTesting(true);
    setStatusMessage(null);

    const result = await verifyApiKey(key);
    setTesting(false);

    if (result.success) {
      await saveCustomApiKey(key);
      setStatusMessage({ text: result.message || 'Success! Gemini Vision is connected.', success: true });
      if (onKeySaved) onKeySaved();
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setStatusMessage({ text: result.message, success: false });
    }
  };

  const openKeyUrl = () => {
    Linking.openURL('https://aistudio.google.com/apikey');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="key" size={18} color={colors.primary} />
              </View>
              <Text style={styles.title}>Gemini Vision API Key</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            SSgraveYard uses Gemini Vision to read image contents (chalkboard notes, menus, tickets, products).
          </Text>

          {/* Key Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Paste AIzaSy... key here"
              placeholderTextColor={colors.textMuted}
              value={key}
              onChangeText={setKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
            />
            {key.length > 0 && (
              <TouchableOpacity onPress={() => setKey('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Feedback Status */}
          {statusMessage && (
            <View
              style={[
                styles.statusBox,
                statusMessage.success ? styles.statusBoxSuccess : styles.statusBoxError,
              ]}
            >
              <Ionicons
                name={statusMessage.success ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={statusMessage.success ? colors.primaryDark : colors.error}
              />
              <Text
                style={[
                  styles.statusText,
                  statusMessage.success ? styles.statusTextSuccess : styles.statusTextError,
                ]}
              >
                {statusMessage.text}
              </Text>
            </View>
          )}

          {/* Link to free key */}
          <TouchableOpacity onPress={openKeyUrl} style={styles.linkRow}>
            <Ionicons name="open-outline" size={14} color={colors.primary} />
            <Text style={styles.linkText}>Get a free API key at aistudio.google.com</Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={testing}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleTestAndSave}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Verify & Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.limeLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  clearBtn: {
    padding: 4,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBoxSuccess: {
    backgroundColor: colors.limeLight,
    borderColor: colors.limeBorder,
  },
  statusBoxError: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
  },
  statusText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  statusTextSuccess: {
    color: colors.limeDark,
    fontWeight: '600',
  },
  statusTextError: {
    color: colors.error,
    fontWeight: '500',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
