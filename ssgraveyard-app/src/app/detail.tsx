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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, categories } from '../theme';
import { getAllEntries, deleteEntry, updateEntry, Entry } from '../storage';
import { analyzeScreenshot } from '../ai';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { getActiveApiKey } from '../constants';

export default function Detail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);

  const handleReAnalyze = async () => {
    if (!entry) return;
    const key = await getActiveApiKey();
    if (!key || key.trim().length < 15) {
      setApiKeyModalVisible(true);
      return;
    }

    setReanalyzing(true);
    try {
      const res = await analyzeScreenshot(entry.imageUri);
      await updateEntry(entry.id, {
        category: res.category,
        categoryLabel: res.categoryLabel,
        intent: res.intent,
        summary: res.summary,
        tags: res.tags,
      });
      setEntry({
        ...entry,
        category: res.category,
        categoryLabel: res.categoryLabel,
        intent: res.intent,
        summary: res.summary,
        tags: res.tags,
      });
      setSelectedCategory(res.category);
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message || 'Could not re-analyze image with Gemini.');
    } finally {
      setReanalyzing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const all = await getAllEntries();
      const found = all.find((e) => e.id === id) ?? null;
      setEntry(found);
      setSelectedCategory(found?.category ?? null);
      setLoading(false);
    })();
  }, [id]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Screenshot', 'Are you sure you want to remove this screenshot from your vault?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (id) await deleteEntry(id);
          handleGoBack();
        },
      },
    ]);
  };

  const handleSaveEdit = async () => {
    if (!entry || !selectedCategory) return;
    setSaving(true);
    const catLabel = categories.find((c) => c.id === selectedCategory)?.label ?? 'Ideas & Notes';
    await updateEntry(entry.id, { category: selectedCategory, categoryLabel: catLabel });
    setEntry({ ...entry, category: selectedCategory, categoryLabel: catLabel });
    setEditing(false);
    setSaving(false);
  };

  const getCategoryIcon = (catId?: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.icon : 'folder-outline';
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
        <Text style={styles.notFound}>Entry not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Top Bar Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBtn} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>Screenshot Details</Text>
        <TouchableOpacity style={styles.navBtnDanger} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Main Image */}
      <View style={styles.imageCard}>
        <Image source={{ uri: entry.imageUri }} style={styles.image} resizeMode="cover" />
      </View>

      {/* Category Card */}
      <View style={styles.detailCard}>
        <View style={styles.categoryRow}>
          <View style={styles.catBadge}>
            <Ionicons
              name={getCategoryIcon(entry.category)}
              size={15}
              color={colors.primaryDark}
            />
            <Text style={styles.catBadgeLabel}>{entry.categoryLabel}</Text>
          </View>
          <TouchableOpacity
            style={styles.editToggle}
            onPress={() => setEditing(!editing)}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.primaryDark} />
            <Text style={styles.editToggleText}>{editing ? 'Cancel' : 'Change'}</Text>
          </TouchableOpacity>
        </View>

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
            <TouchableOpacity
              style={styles.saveCategoryBtn}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveCategoryBtnText}>Update Category</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Intent */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DETECTED INTENT</Text>
          <Text style={styles.intentText}>{entry.intent}</Text>
        </View>

        {/* Summary */}
        {entry.summary ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AI SUMMARY</Text>
            <Text style={styles.summaryText}>{entry.summary}</Text>
          </View>
        ) : null}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TAGS</Text>
            <View style={styles.tagsContainer}>
              {entry.tags.map((tag, idx) => (
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
            Added on {new Date(entry.createdAt).toLocaleDateString()} at{' '}
            {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>

      <ApiKeyModal
        visible={apiKeyModalVisible}
        onClose={() => setApiKeyModalVisible(false)}
        onKeySaved={handleReAnalyze}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reanalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
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
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 40,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: colors.background,
  },
  notFound: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  /* Top Navigation */
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
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

  /* Image Preview */
  imageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  image: {
    width: '100%',
    height: 280,
  },

  /* Detail Card */
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
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  editToggleText: {
    fontSize: 12,
    color: colors.primaryDark,
    fontWeight: '600',
  },

  /* Category Editing */
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
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  editChipActive: {
    backgroundColor: colors.limeLight,
    borderColor: colors.primary,
  },
  editChipText: {
    fontSize: 11,
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
    fontWeight: '600',
    fontSize: 12,
  },

  /* Sections */
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  intentText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  /* Meta */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
