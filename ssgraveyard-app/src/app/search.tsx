import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, categories } from '../theme';
import { searchEntries, deleteEntry, Entry } from '../storage';
import { DetailModal } from '../components/DetailModal';
import { useAuth } from '../context/AuthContext';

export default function Search() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<Entry | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const runSearch = useCallback(async (q: string, categoryFilter: string | null = selectedCategory) => {
    setLoading(true);
    let r = await searchEntries(q, user?.id);
    if (categoryFilter) {
      r = r.filter((item) => item.category === categoryFilter);
    }
    setResults(r);
    setSearched(true);
    setLoading(false);
  }, [user?.id, selectedCategory]);

  useEffect(() => {
    runSearch('');
  }, [runSearch]);

  const onChangeText = (text: string) => {
    setQuery(text);
    runSearch(text, selectedCategory);
  };

  const handleCategoryPress = (catId: string | null) => {
    const next = selectedCategory === catId ? null : catId;
    setSelectedCategory(next);
    runSearch(query, next);
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
            setResults((prev) => prev.filter((e) => e.id !== item.id));
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

  const getCategoryIcon = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return found ? found.icon : 'folder-outline';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search Vault</Text>
        <Text style={styles.headerSub}>Find screenshots by keyword, brand, intent, or tag</Text>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder='Try "café", "wishlist", "flight"…'
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              runSearch('', selectedCategory);
            }}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <View style={styles.chipsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.chipsContainer}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => handleCategoryPress(item.id)}
              >
                <Ionicons
                  name={item.icon}
                  size={13}
                  color={isSelected ? colors.primaryDark : colors.textSecondary}
                />
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Results List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="search-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No matching screenshots</Text>
          <Text style={styles.emptySub}>
            Try searching with broader terms or clear category filters.
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.78}
              onPress={() => handleOpenDetail(item)}
              onLongPress={() => handleLongPressCard(item)}
              delayLongPress={300}
            >
              <Image source={{ uri: item.imageUri }} style={styles.thumb} resizeMode="cover" />
              <View style={styles.cardBody}>
                <View style={styles.catRow}>
                  <View style={styles.catBadge}>
                    <Ionicons
                      name={getCategoryIcon(item.category)}
                      size={12}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.catText}>{item.categoryLabel}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteEntry(item);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.intent} numberOfLines={2}>
                  {item.intent}
                </Text>
                {item.tags.length > 0 && (
                  <Text style={styles.tags} numberOfLines={1}>
                    {item.tags.map((t) => `#${t}`).join('  ')}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
      <DetailModal
        visible={detailModalVisible}
        entry={selectedDetailEntry}
        onClose={() => setDetailModalVisible(false)}
        onDeleted={(id) => {
          setResults((prev) => prev.filter((e) => e.id !== id));
          setDetailModalVisible(false);
        }}
        onUpdated={(updated) => {
          setResults((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          setSelectedDetailEntry(updated);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  clearBtn: {
    padding: 4,
  },

  chipsRow: {
    paddingBottom: 10,
  },
  chipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.limeLight,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.limeDark,
    fontWeight: '700',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.limeLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.limeBorder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: colors.surfaceSubtle,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.limeLight,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  catText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.limeDark,
  },
  intent: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  tags: {
    fontSize: 11,
    color: colors.textMuted,
  },
});