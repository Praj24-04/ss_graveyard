import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  AppState,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, categories } from '../theme';
import { getAllEntries, deleteEntry, seedSampleData, Entry } from '../storage';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { DetailModal } from '../components/DetailModal';
import { useAuth } from '../context/AuthContext';
import { getActiveApiKey } from '../constants';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<Entry | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const checkApiKey = useCallback(async () => {
    const key = await getActiveApiKey();
    setHasApiKey(Boolean(key && key.trim().length > 15));
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey, apiKeyModalVisible]);

  const load = useCallback(async () => {
    const all = await getAllEntries(user?.id);
    setEntries(all);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load();
      }
    });
    return () => sub.remove();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSeedSamples = async () => {
    setRefreshing(true);
    const seeded = await seedSampleData(user?.id);
    setEntries(seeded);
    setRefreshing(false);
  };

  const handleOpenDetail = (item: Entry) => {
    setSelectedDetailEntry(item);
    setDetailModalVisible(true);
  };

  const handleDeleteEntry = (item: Entry) => {
    Alert.alert(
      'Delete Screenshot',
      `Are you sure you want to remove "${item.intent || 'this screenshot'}" from your vault?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(item.id);
            setEntries((prev) => prev.filter((e) => e.id !== item.id));
          },
        },
      ]
    );
  };

  const handleLongPressCard = (item: Entry) => {
    Alert.alert(
      'Screenshot Options',
      item.intent || item.categoryLabel,
      [
        {
          text: 'View Details',
          onPress: () => handleOpenDetail(item),
        },
        {
          text: 'Delete Screenshot',
          style: 'destructive',
          onPress: () => handleDeleteEntry(item),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const filtered = activeCategory
    ? entries.filter((e) => e.category === activeCategory)
    : entries;

  const countFor = (catId: string) => entries.filter((e) => e.category === catId).length;

  const allCategories: { id: string | null; label: string; icon: any }[] = [
    { id: null, label: 'All', icon: 'apps-outline' },
    ...categories,
  ];

  const getCategoryIcon = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.icon : 'folder-outline';
  };

  const formatDate = (timestamp: number) => {
    const diffHours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const userFirstName = user?.name ? user.name.split(' ')[0] : null;

  return (
    <View style={styles.container}>
      {/* Top Header - Creative Human Identity & Cohesive Layout */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.brandRow}
          activeOpacity={0.85}
          onPress={() => onRefresh()}
        >
          {/* Creative Emblem: Stylized Obsidian & Neon Lime Ghost Tombstone */}
          <View style={styles.brandEmblem}>
            <Text style={styles.brandGhostEmoji}>👻</Text>
            <View style={styles.brandNeonDot} />
          </View>

          <View style={styles.brandTextContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.brandTitleMain}>
                <Text style={styles.brandTitleGreen}>SS</Text>
                <Text style={styles.brandTitleDark}>GRAVEYARD</Text>
              </Text>
              <View style={styles.graveyardBadge}>
                <Text style={styles.graveyardBadgeText}>R.I.P.</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>
              {userFirstName ? `${userFirstName}'s Vault` : 'Vault'} • {entries.length} resurrected
            </Text>
          </View>
        </TouchableOpacity>

        {/* Clean, Non-Overflowing Header Controls */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.aiStatusChip, hasApiKey ? styles.aiStatusActive : styles.aiStatusSetup]}
            onPress={() => setApiKeyModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={hasApiKey ? 'sparkles' : 'key-outline'}
              size={13}
              color={hasApiKey ? '#15803D' : '#854D0E'}
            />
            <Text style={[styles.aiStatusText, hasApiKey ? styles.aiStatusTextActive : styles.aiStatusTextSetup]}>
              {hasApiKey ? 'Vision AI' : 'Setup AI'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push('/profile' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {userFirstName ? userFirstName.charAt(0).toUpperCase() : 'P'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Stats / Overview Card */}
      {entries.length > 0 && (
        <View style={styles.heroCard}>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{entries.length}</Text>
              <Text style={styles.heroStatLabel}>Resurrected</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>
                {new Set(entries.map((e) => e.category)).size}
              </Text>
              <Text style={styles.heroStatLabel}>Categories</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroAiPill}>
                <Ionicons name="sparkles" size={12} color={colors.primary} />
                <Text style={styles.heroAiPillText}>Auto-Sorted</Text>
              </View>
              <Text style={styles.heroStatLabel}>Gemini Vision</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category Filter Chips */}
      <View style={styles.chipsSection}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={allCategories}
          keyExtractor={(item) => String(item.id ?? 'all')}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const isActive = activeCategory === item.id;
            return (
              <TouchableOpacity
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => setActiveCategory(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={isActive ? colors.primaryDark : colors.textSecondary}
                />
                <Text style={[styles.chipLabel, isActive && styles.chipLabelActive]}>
                  {item.label}
                </Text>
                {item.id !== null && countFor(item.id) > 0 && (
                  <View style={[styles.chipBadge, isActive && styles.chipBadgeActive]}>
                    <Text
                      style={[
                        styles.chipBadgeText,
                        isActive && styles.chipBadgeTextActive,
                      ]}
                    >
                      {countFor(item.id)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Main Content Feed */}
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="images-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeCategory ? 'No items in this category' : 'No screenshots saved yet'}
          </Text>
          <Text style={styles.emptySub}>
            {activeCategory
              ? 'Select another category or upload a screenshot to organize.'
              : 'Pick a screenshot to have AI automatically categorize, summarize, and tag it.'}
          </Text>

          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyPrimaryBtn}
              onPress={() => router.push('/upload')}
            >
              <Ionicons name="add-circle" size={18} color="#FFFFFF" />
              <Text style={styles.emptyPrimaryBtnText}>Upload Screenshot</Text>
            </TouchableOpacity>

            {!activeCategory && (
              <TouchableOpacity
                style={styles.emptySecondaryBtn}
                onPress={handleSeedSamples}
              >
                <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
                <Text style={styles.emptySecondaryBtnText}>Load Sample Data</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.78}
              onPress={() => handleOpenDetail(item)}
              onLongPress={() => handleLongPressCard(item)}
              delayLongPress={300}
            >
              <Image source={{ uri: item.imageUri }} style={styles.thumbnail} resizeMode="cover" />

              <View style={styles.cardContent}>
                <View style={styles.cardTopRow}>
                  <View style={styles.categoryPill}>
                    <Ionicons
                      name={getCategoryIcon(item.category)}
                      size={13}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.categoryPillText}>{item.categoryLabel}</Text>
                  </View>
                  <View style={styles.cardTopRight}>
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                    <TouchableOpacity
                      style={styles.cardTrashBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteEntry(item);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.intentTitle} numberOfLines={2}>
                  {item.intent}
                </Text>

                {item.summary ? (
                  <Text style={styles.summaryText} numberOfLines={2}>
                    {item.summary}
                  </Text>
                ) : null}

                {item.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {item.tags.slice(0, 3).map((tag, idx) => (
                      <View key={idx} style={styles.tagPill}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.cardChevron}>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <DetailModal
        visible={detailModalVisible}
        entry={selectedDetailEntry}
        onClose={() => setDetailModalVisible(false)}
        onDeleted={(id) => {
          setEntries((prev) => prev.filter((e) => e.id !== id));
          setDetailModalVisible(false);
        }}
        onUpdated={(updated) => {
          setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          setSelectedDetailEntry(updated);
        }}
      />
      <ApiKeyModal
        visible={apiKeyModalVisible}
        onClose={() => setApiKeyModalVisible(false)}
        onKeySaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  brandEmblem: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#84CC16',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  brandGhostEmoji: {
    fontSize: 22,
  },
  brandNeonDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#22C55E',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  brandTextContainer: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitleMain: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTitleGreen: {
    color: '#16A34A',
  },
  brandTitleDark: {
    color: '#0F172A',
  },
  graveyardBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  graveyardBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#84CC16',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  aiStatusActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  aiStatusSetup: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FDE047',
  },
  aiStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  aiStatusTextActive: {
    color: '#15803D',
  },
  aiStatusTextSetup: {
    color: '#854D0E',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  heroAiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroAiPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },

  /* Hero Overview */
  heroCard: {
    marginHorizontal: 18,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  heroStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  heroStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },

  /* Category Filter Chips */
  chipsSection: {
    paddingVertical: 10,
  },
  chips: {
    paddingHorizontal: 18,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.limeLight,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: colors.limeDark,
    fontWeight: '700',
  },
  chipBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipBadgeActive: {
    backgroundColor: colors.primary,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipBadgeTextActive: {
    color: '#FFFFFF',
  },

  /* Empty State */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.limeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActions: {
    width: '100%',
    gap: 10,
    alignItems: 'center',
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
  },
  emptyPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptySecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.limeBorder,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptySecondaryBtnText: {
    color: colors.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },

  /* Feed List */
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.limeLight,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.limeDark,
  },
  cardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTrashBtn: {
    padding: 3,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  intentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagPill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  cardChevron: {
    paddingLeft: 4,
  },
});