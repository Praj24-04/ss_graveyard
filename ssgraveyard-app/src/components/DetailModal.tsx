import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, categories } from '../theme';
import { deleteEntry, updateEntry, Entry } from '../storage';
import { analyzeScreenshot } from '../ai';

interface DetailModalProps {
  visible: boolean;
  entry: Entry | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (entry: Entry) => void;
}

export function DetailModal({
  visible,
  entry,
  onClose,
  onDeleted,
  onUpdated,
}: DetailModalProps) {
  const [currentEntry, setCurrentEntry] = useState<Entry | null>(entry);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    setCurrentEntry(entry);
    setSelectedCategory(entry?.category ?? null);
    setEditing(false);
  }, [entry, visible]);

  if (!currentEntry) return null;

  const getCategoryIcon = (catId?: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.icon : 'folder-outline';
  };

  const handleReAnalyze = async () => {
    if (!currentEntry) return;

    setReanalyzing(true);
    try {
      const res = await analyzeScreenshot(currentEntry.imageUri);
      const updated: Entry = {
        ...currentEntry,
        category: res.category,
        categoryLabel: res.categoryLabel,
        intent: res.intent,
        summary: res.summary,
        tags: res.tags,
      };

      await updateEntry(currentEntry.id, {
        category: res.category,
        categoryLabel: res.categoryLabel,
        intent: res.intent,
        summary: res.summary,
        tags: res.tags,
      });

      setCurrentEntry(updated);
      setSelectedCategory(res.category);
      onUpdated(updated);
      Alert.alert('Analysis Complete', `Classified as "${res.categoryLabel}" with Gemini Vision.`);
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message || 'Could not re-analyze image with Gemini.');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDelete = () => {
    if (!currentEntry) return;
    Alert.alert(
      'Delete Screenshot',
      `Are you sure you want to remove "${currentEntry.intent || 'this screenshot'}" from your vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const idToDelete = currentEntry.id;
            await deleteEntry(idToDelete);
            onDeleted(idToDelete);
            onClose();
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!currentEntry || !selectedCategory) return;
    setSaving(true);
    const catLabel = categories.find((c) => c.id === selectedCategory)?.label ?? 'Ideas & Notes';
    const updated: Entry = {
      ...currentEntry,
      category: selectedCategory,
      categoryLabel: catLabel,
    };

    await updateEntry(currentEntry.id, { category: selectedCategory, categoryLabel: catLabel });
    setCurrentEntry(updated);
    setEditing(false);
    setSaving(false);
    onUpdated(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        {/* Top Bar Navigation */}
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.navBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topNavTitle}>Screenshot Details</Text>
          <TouchableOpacity style={styles.navBtnDanger} onPress={handleDelete} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
          {/* Main Image */}
          <View style={styles.imageCard}>
            <Image
              source={{ uri: currentEntry.imageUri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>

          {/* Details Card */}
          <View style={styles.detailCard}>
            {/* Category Row */}
            <View style={styles.categoryRow}>
              <View style={styles.catBadge}>
                <Ionicons
                  name={getCategoryIcon(currentEntry.category)}
                  size={15}
                  color={colors.primaryDark}
                />
                <Text style={styles.catBadgeLabel}>{currentEntry.categoryLabel}</Text>
              </View>
              <TouchableOpacity
                style={styles.editToggle}
                onPress={() => setEditing(!editing)}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.editToggleText}>{editing ? 'Cancel' : 'Change'}</Text>
              </TouchableOpacity>
            </View>

            {/* Category Edit Grid */}
            {editing && (
              <View style={styles.editGrid}>
                <Text style={styles.sectionSmallLabel}>Select New Category:</Text>
                <View style={styles.chipsWrap}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.editChip,
                        selectedCategory === c.id && styles.editChipActive,
                      ]}
                      onPress={() => setSelectedCategory(c.id)}
                    >
                      <Ionicons
                        name={c.icon}
                        size={13}
                        color={selectedCategory === c.id ? colors.primaryDark : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.editChipText,
                          selectedCategory === c.id && styles.editChipTextActive,
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {selectedCategory !== currentEntry.category && (
                  <TouchableOpacity
                    style={styles.saveCategoryBtn}
                    onPress={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveCategoryBtnText}>Save Category</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Re-Analyze with Gemini Vision Button */}
            <TouchableOpacity
              style={styles.reanalyzeBtn}
              onPress={handleReAnalyze}
              disabled={reanalyzing}
              activeOpacity={0.8}
            >
              {reanalyzing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  <Text style={styles.reanalyzeBtnText}>Re-analyze with Gemini Vision</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Intent Title */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DETECTED INTENT</Text>
              <Text style={styles.intentText}>{currentEntry.intent}</Text>
            </View>

            {/* Summary */}
            {currentEntry.summary ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>AI SUMMARY</Text>
                <Text style={styles.summaryText}>{currentEntry.summary}</Text>
              </View>
            ) : null}

            {/* Tags */}
            {currentEntry.tags && currentEntry.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TAGS</Text>
                <View style={styles.tagsContainer}>
                  {currentEntry.tags.map((tag, idx) => (
                    <View key={idx} style={styles.tagBadge}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Date Added */}
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>
                Added on {new Date(currentEntry.createdAt).toLocaleDateString()} at{' '}
                {new Date(currentEntry.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            {/* Bottom Delete Button */}
            <TouchableOpacity style={styles.bottomDeleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={styles.bottomDeleteText}>Delete from Vault</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 50,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 16,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  navBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  navBtnDanger: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: 300,
  },
  detailCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.limeLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  catBadgeLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.limeDark,
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editToggleText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  editGrid: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  sectionSmallLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  editChipActive: {
    backgroundColor: colors.limeLight,
    borderColor: colors.limeBorder,
  },
  editChipText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  editChipTextActive: {
    color: colors.limeDark,
    fontWeight: '700',
  },
  saveCategoryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveCategoryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  reanalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  reanalyzeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  intentText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 24,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  bottomDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    marginTop: 6,
  },
  bottomDeleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
});
