import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, categories } from '../theme';
import { analyzeScreenshot, AIResult } from '../ai';
import { saveEntry } from '../storage';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { useAuth } from '../context/AuthContext';
import { getActiveApiKey } from '../constants';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ItemStatus = 'pending' | 'analyzing' | 'done' | 'error';

interface BulkItem {
  id: string;
  uri: string;
  status: ItemStatus;
  result?: AIResult;
  errorMsg?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CONCURRENCY = 3; // max parallel Gemini API calls

// ─── Component ──────────────────────────────────────────────────────────────────

export default function Upload() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<BulkItem[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const processingRef = useRef(false);

  const checkApiKey = useCallback(async () => {
    const key = await getActiveApiKey();
    setHasApiKey(Boolean(key && key.trim().length > 15));
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey, apiKeyModalVisible]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const updateItem = useCallback((id: string, patch: Partial<BulkItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const getCategoryIcon = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.icon : 'folder-outline';
  };

  // ── Pick images ──────────────────────────────────────────────────────────────

  const launchGalleryPicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.6,
      base64: false,
      selectionLimit: 50,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newItems: BulkItem[] = result.assets.map((asset, i) => ({
        id: `${Date.now()}-${i}`,
        uri: asset.uri,
        status: 'pending' as ItemStatus,
      }));
      setItems(newItems);
      setAllDone(false);
      startBatchProcessing(newItems);
    }
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed to select screenshots.');
      return;
    }

    const key = await getActiveApiKey();
    const keyExists = Boolean(key && key.trim().length > 15);

    if (!keyExists) {
      Alert.alert(
        'Gemini Vision AI Recommended',
        'To accurately identify and sort food, outfits/people, study notes, and shopping items, connect your free Gemini API key.\n\nWithout it, photos use offline fallback and may default to Ideas & Notes.',
        [
          {
            text: 'Connect API Key',
            onPress: () => setApiKeyModalVisible(true),
          },
          {
            text: 'Continue Offline',
            style: 'cancel',
            onPress: () => launchGalleryPicker(),
          },
        ]
      );
      return;
    }

    await launchGalleryPicker();
  };

  // ── Batch processing engine ───────────────────────────────────────────────────

  const processOne = async (item: BulkItem) => {
    updateItem(item.id, { status: 'analyzing' });
    try {
      const result = await analyzeScreenshot(item.uri);

      await saveEntry({
        id: item.id,
        userId: user?.id,
        imageUri: item.uri,
        category: result.category,
        categoryLabel: result.categoryLabel,
        intent: result.intent,
        summary: result.summary,
        tags: result.tags,
        createdAt: Date.now(),
        confirmedByUser: true,
      });

      updateItem(item.id, { status: 'done', result });
    } catch (err) {
      updateItem(item.id, {
        status: 'error',
        errorMsg: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const startBatchProcessing = async (initialItems: BulkItem[]) => {
    if (processingRef.current) return;
    processingRef.current = true;

    const queue = [...initialItems];
    const runNext = async (): Promise<void> => {
      const item = queue.shift();
      if (!item) return;
      await processOne(item);
      await runNext();
    };

    const slots = Array.from(
      { length: Math.min(CONCURRENCY, initialItems.length) },
      () => runNext()
    );
    await Promise.all(slots);

    processingRef.current = false;
    setAllDone(true);
  };

  // ── Derived stats ────────────────────────────────────────────────────────────

  const total = items.length;
  const doneCount = items.filter((it) => it.status === 'done').length;
  const errorCount = items.filter((it) => it.status === 'error').length;
  const pendingCount = items.filter(
    (it) => it.status === 'pending' || it.status === 'analyzing'
  ).length;

  const categorySummary = items
    .filter((it) => it.status === 'done' && it.result)
    .reduce<Record<string, { label: string; icon: string; count: number }>>(
      (acc, it) => {
        const cat = it.result!;
        if (!acc[cat.category]) {
          acc[cat.category] = {
            label: cat.categoryLabel,
            icon: getCategoryIcon(cat.category),
            count: 0,
          };
        }
        acc[cat.category].count++;
        return acc;
      },
      {}
    );

  // ── Render item ───────────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: BulkItem }) => (
    <View style={styles.itemRow}>
      <Image source={{ uri: item.uri }} style={styles.itemThumb} />
      <View style={styles.itemInfo}>
        {item.status === 'pending' && (
          <Text style={styles.itemStatusPending}>Waiting…</Text>
        )}
        {item.status === 'analyzing' && (
          <View style={styles.itemAnalyzingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.itemStatusAnalyzing}>AI analyzing…</Text>
          </View>
        )}
        {item.status === 'done' && item.result && (
          <>
            <View style={styles.itemCatPill}>
              <Ionicons
                name={getCategoryIcon(item.result.category) as any}
                size={12}
                color={colors.primaryDark}
              />
              <Text style={styles.itemCatText}>{item.result.categoryLabel}</Text>
            </View>
            <Text style={styles.itemIntent} numberOfLines={2}>
              {item.result.intent}
            </Text>
            {item.result.isRealAi && (
              <View style={styles.geminiChip}>
                <Ionicons name="sparkles" size={10} color={colors.primary} />
                <Text style={styles.geminiChipText}>Gemini</Text>
              </View>
            )}
          </>
        )}
        {item.status === 'error' && (
          <View style={styles.itemErrorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
            <Text style={styles.itemErrorText}>Failed — will retry next import</Text>
          </View>
        )}
      </View>
      <View style={styles.itemStatusIcon}>
        {item.status === 'done' && (
          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
        )}
        {item.status === 'error' && (
          <Ionicons name="close-circle" size={22} color={colors.error} />
        )}
        {item.status === 'analyzing' && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
        {item.status === 'pending' && (
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
        )}
      </View>
    </View>
  );

  // ── Empty / picker state ──────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Bulk Import</Text>
            <TouchableOpacity
              style={[styles.keyBtn, hasApiKey ? styles.keyBtnActive : styles.keyBtnSetup]}
              onPress={() => setApiKeyModalVisible(true)}
            >
              <Ionicons
                name={hasApiKey ? 'sparkles' : 'key-outline'}
                size={14}
                color={hasApiKey ? '#15803D' : '#854D0E'}
              />
              <Text style={[styles.keyBtnText, hasApiKey ? styles.keyBtnTextActive : styles.keyBtnTextSetup]}>
                {hasApiKey ? 'Vision AI' : 'Setup AI'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>
            Select multiple screenshots at once. AI categorizes all of them automatically.
          </Text>
        </View>

        {/* AI Vision Status Callout */}
        {hasApiKey ? (
          <View style={styles.aiBannerActive}>
            <View style={styles.aiBannerIconCircle}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
            </View>
            <View style={styles.aiBannerTextWrap}>
              <Text style={styles.aiBannerTitleActive}>Gemini 2.0 Flash Vision Active</Text>
              <Text style={styles.aiBannerSubActive}>
                Multimodal AI recognizes food, outfits, notes, places, and wishlists.
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.aiBannerWarning}
            activeOpacity={0.85}
            onPress={() => setApiKeyModalVisible(true)}
          >
            <View style={styles.aiBannerWarnIconCircle}>
              <Ionicons name="key" size={16} color="#B45309" />
            </View>
            <View style={styles.aiBannerTextWrap}>
              <Text style={styles.aiBannerTitleWarning}>Gemini API Key Needed for Accurate Vision</Text>
              <Text style={styles.aiBannerSubWarning}>
                Tap to connect Gemini. Without it, real vision AI is inactive.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#B45309" />
          </TouchableOpacity>
        )}

        <Pressable style={styles.dropZone} onPress={pickImages}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="images-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.dropTitle}>Select Screenshots</Text>
          <Text style={styles.dropSub}>{"Choose any number \u2014 we'll sort them all"}</Text>
          <View style={styles.selectBtn}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.selectBtnText}>Open Gallery</Text>
          </View>
        </Pressable>

        <View style={styles.hints}>
          {(
            [
              {
                icon: 'checkmark-done-outline',
                text: 'Select up to 50 screenshots at once',
              },
              { icon: 'flash-outline', text: 'Up to 3 processed simultaneously' },
              {
                icon: 'folder-open-outline',
                text: 'Each auto-filed into the right category',
              },
            ] as { icon: string; text: string }[]
          ).map((h, i) => (
            <View key={i} style={styles.hintRow}>
              <View style={styles.hintIconBox}>
                <Ionicons name={h.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={styles.hintText}>{h.text}</Text>
            </View>
          ))}
        </View>

        <ApiKeyModal
          visible={apiKeyModalVisible}
          onClose={() => setApiKeyModalVisible(false)}
          onKeySaved={checkApiKey}
        />
      </ScrollView>
    );
  }

  // ── Processing / done state ───────────────────────────────────────────────────

  return (
    <View style={styles.fill}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>
            {allDone ? 'Import Complete' : 'Processing…'}
          </Text>
          <TouchableOpacity
            style={[styles.keyBtn, hasApiKey ? styles.keyBtnActive : styles.keyBtnSetup]}
            onPress={() => setApiKeyModalVisible(true)}
          >
            <Ionicons
              name={hasApiKey ? 'sparkles' : 'key-outline'}
              size={14}
              color={hasApiKey ? '#15803D' : '#854D0E'}
            />
            <Text style={[styles.keyBtnText, hasApiKey ? styles.keyBtnTextActive : styles.keyBtnTextSetup]}>
              {hasApiKey ? 'Vision AI' : 'Setup AI'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${
                  total > 0 ? ((doneCount + errorCount) / total) * 100 : 0
                }%`,
              },
            ]}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
            <Text style={styles.statText}>{doneCount} done</Text>
          </View>
          {errorCount > 0 && (
            <View style={[styles.statChip, styles.statChipError]}>
              <Ionicons name="close-circle" size={13} color={colors.error} />
              <Text style={[styles.statText, { color: colors.error }]}>
                {errorCount} failed
              </Text>
            </View>
          )}
          {pendingCount > 0 && (
            <View style={styles.statChip}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {pendingCount} left
              </Text>
            </View>
          )}
          <Text style={styles.statTotal}>{total} total</Text>
        </View>
      </View>

      {/* Category summary when done */}
      {allDone && Object.keys(categorySummary).length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Saved to Categories</Text>
          <View style={styles.summaryGrid}>
            {Object.entries(categorySummary).map(([catId, { label, icon, count }]) => (
              <View key={catId} style={styles.summaryCard}>
                <Ionicons name={icon as any} size={20} color={colors.primaryDark} />
                <Text style={styles.summaryCount}>{count}</Text>
                <Text style={styles.summaryLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Item list */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          allDone ? (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => router.replace('/')}
              >
                <Ionicons name="home-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Go to Vault</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => {
                  setItems([]);
                  setAllDone(false);
                }}
              >
                <Ionicons name="add" size={18} color={colors.primaryDark} />
                <Text style={styles.secondaryActionBtnText}>Import More</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      <ApiKeyModal
        visible={apiKeyModalVisible}
        onClose={() => setApiKeyModalVisible(false)}
        onKeySaved={() => {}}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 20, paddingTop: 54, paddingBottom: 60 },

  header: { marginBottom: 20 },
  stickyHeader: {
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  keyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  keyBtnActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  keyBtnSetup: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  keyBtnText: { fontSize: 12, fontWeight: '700' },
  keyBtnTextActive: { color: '#15803D' },
  keyBtnTextSetup: { color: '#854D0E' },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },

  aiBannerActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  aiBannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBannerTextWrap: {
    flex: 1,
  },
  aiBannerTitleActive: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803D',
  },
  aiBannerSubActive: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
    lineHeight: 15,
  },
  aiBannerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  aiBannerWarnIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBannerTitleWarning: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  aiBannerSubWarning: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 15,
  },

  dropZone: {
    borderWidth: 2,
    borderColor: colors.limeBorder,
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: colors.surface,
    paddingVertical: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.limeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  dropTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 6 },
  dropSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
    textAlign: 'center',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  selectBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  hints: { marginTop: 28, gap: 12 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hintIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.limeLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  hintText: { fontSize: 13, color: colors.textSecondary, flex: 1 },

  progressBarTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.limeLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  statChipError: { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
  statText: { fontSize: 12, fontWeight: '600', color: colors.limeDark },
  statTotal: { marginLeft: 'auto', fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  summarySection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.limeLight,
    borderWidth: 1,
    borderColor: colors.limeBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    minWidth: 80,
  },
  summaryCount: { fontSize: 18, fontWeight: '800', color: colors.limeDark },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primaryDark,
    textAlign: 'center',
  },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 10 },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemThumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  itemInfo: { flex: 1, gap: 4 },
  itemStatusPending: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  itemAnalyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemStatusAnalyzing: { fontSize: 13, color: colors.primary, fontWeight: '500' },
  itemCatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.limeLight,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  itemCatText: { fontSize: 11, fontWeight: '700', color: colors.limeDark },
  itemIntent: { fontSize: 13, color: colors.text, fontWeight: '500', lineHeight: 17 },
  geminiChip: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  geminiChipText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
  itemErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemErrorText: { fontSize: 13, color: colors.error, fontWeight: '500' },
  itemStatusIcon: { width: 24, alignItems: 'center' },

  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.limeBorder,
    paddingVertical: 13,
    borderRadius: 12,
  },
  secondaryActionBtnText: { color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
});
