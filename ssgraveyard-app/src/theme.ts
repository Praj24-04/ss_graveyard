export const colors = {
  // Backgrounds & Surfaces
  background: '#FFFFFF',
  surface: '#F8FAF8',
  surfaceAlt: '#F0F5F0',
  surfaceSubtle: '#F4F7F4',

  // Cards & Elevation
  card: '#FFFFFF',
  cardBorder: '#E5EBE5',
  cardHover: '#F7FAF7',

  // Commercial Lime Green Palette
  primary: '#16A34A',         // High contrast rich lime/emerald green
  primaryHover: '#15803D',
  primaryDark: '#15803D',      // Deep forest lime
  primaryLime: '#84CC16',     // Vibrant bright lime accent
  limeAccent: '#65A30D',
  limeLight: '#DCFCE7',       // Soft lime badge background
  limeBorder: '#86EFAC',      // Highlight border
  limeDark: '#14532D',        // Dark green for high readability badge text

  // Typography
  text: '#0F172A',            // Deep slate-black for pristine readability
  textSecondary: '#475569',   // Slate gray for subtitles
  textMuted: '#94A3B8',       // Light slate gray for helper labels

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#EEF2EE',

  // Status Colors
  success: '#16A34A',
  successBg: '#F0FDF4',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
};

export interface Category {
  id: string;
  label: string;
  icon: any;
  description: string;
}

export const categories: Category[] = [
  {
    id: 'food',
    label: 'Food & Dining',
    icon: 'restaurant-outline',
    description: 'Dishes, cafés, snacks, drinks & pizza',
  },
  {
    id: 'people',
    label: 'People & Fits',
    icon: 'person-outline',
    description: 'Selfies, portraits, outfits & styling',
  },
  {
    id: 'study',
    label: 'Study & Work',
    icon: 'book-outline',
    description: 'Handwritten sheets, lectures & notes',
  },
  {
    id: 'buy',
    label: 'Things to Buy',
    icon: 'bag-handle-outline',
    description: 'Products, prices, gadgets & wishlists',
  },
  {
    id: 'places',
    label: 'Places & Travel',
    icon: 'airplane-outline',
    description: 'Destinations, spots, maps & hotels',
  },
  {
    id: 'watch',
    label: 'Watch Later',
    icon: 'film-outline',
    description: 'Movies, reels, podcasts & videos',
  },
  {
    id: 'ideas',
    label: 'Ideas & Notes',
    icon: 'bulb-outline',
    description: 'Memes, inspirations, thoughts & quotes',
  },
];
