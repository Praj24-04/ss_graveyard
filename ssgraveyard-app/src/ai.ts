import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { getActiveApiKey, FALLBACK_GEMINI_URL, LEGACY_GEMINI_URL, getWorkingGeminiUrl } from './constants';
import { categories } from './theme';

export type AIResult = {
  category: string;
  categoryLabel: string;
  intent: string;
  summary: string;
  tags: string[];
  isRealAi?: boolean;
};

const CATEGORY_IDS = categories.map((c) => c.id);

// Streamlined prompt optimized for sub-second parsing and token efficiency
const PROMPT = `Analyze this image in detail and categorize it accurately into exactly ONE category.
Return ONLY raw JSON (no markdown formatting, no backticks):
{
  "category": "food" | "people" | "study" | "buy" | "places" | "watch" | "ideas",
  "intent": "short punchy phrase of what this is (max 8 words)",
  "summary": "1 sentence describing the visual content accurately",
  "tags": ["3 to 4 specific keywords"]
}

Strict Rules:
- "food": Any food, meal, dessert, ice cream, pizza, burger, dining dish, drink, coffee, recipe, snack, cooking.
- "people": Any person, selfie, mirror selfie, outfit photo, portrait, hairstyle, fashion, clothing fit on a person.
- "study": Handwritten paper notes, mathematical formulas, lecture slides, textbooks, whiteboard, code snippets, homework.
- "buy": E-commerce product listing, price tags, sneakers, shopping cart, gadget, clothes for sale.
- "places": Travel spots, maps, hotel booking, flight ticket, outdoor architecture, scenic landmark, city view.
- "watch": Instagram/TikTok reels, YouTube video player, movie recommendation, podcast screenshot, show poster.
- "ideas": Graphic design, quotes, memes, WhatsApp/iMessage text screenshot, tweet, miscellaneous thoughts.`;

function smartLocalCategorize(imageUri: string): AIResult {
  const lower = imageUri.toLowerCase();
  let catId = 'ideas';
  let intent = 'Saved visual snap';
  let summary = 'Screenshot saved to your personal library.';
  let tags = ['screenshot', 'snap'];

  if (lower.includes('board') || lower.includes('class') || lower.includes('cpu') || lower.includes('note') || lower.includes('doc')) {
    catId = 'study';
    intent = 'Study & lecture reference';
    summary = 'Diagram, notes or lecture material captured for study.';
    tags = ['study', 'notes', 'reference'];
  } else if (lower.includes('food') || lower.includes('pizza') || lower.includes('eat') || lower.includes('dish') || lower.includes('cafe')) {
    catId = 'food';
    intent = 'Delicious food or dining spot';
    summary = 'Food, recipe or dining reference saved to try.';
    tags = ['food', 'dining', 'treat'];
  } else if (lower.includes('selfie') || lower.includes('fit') || lower.includes('outfit') || lower.includes('portrait')) {
    catId = 'people';
    intent = 'Outfit & visual style reference';
    summary = 'Portrait, styling or outfit inspiration.';
    tags = ['outfit', 'style', 'portrait'];
  } else if (lower.includes('shop') || lower.includes('buy') || lower.includes('cart') || lower.includes('price')) {
    catId = 'buy';
    intent = 'Item to buy or wishlist';
    summary = 'Product saved for shopping or wishlist.';
    tags = ['buy', 'shopping', 'wishlist'];
  }

  const catLabel = categories.find((c) => c.id === catId)?.label ?? 'Ideas & Notes';
  return {
    category: catId,
    categoryLabel: catLabel,
    intent,
    summary,
    tags,
    isRealAi: false,
  };
}

export async function analyzeScreenshot(imageUri: string, base64Override?: string): Promise<AIResult> {
  let base64 = base64Override;

  // 1. FAST COMPRESSION & DOWNSCALING (Reduces 10MB phone photo to ~50KB in <100ms)
  try {
    const manip = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (manip.base64) {
      base64 = manip.base64;
    }
  } catch (manipErr) {
    console.warn('ImageManipulator resize failed, falling back to raw reader:', manipErr);
    if (!base64) {
      try {
        base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (fsErr) {
        console.warn('FileSystem read error:', fsErr);
      }
    }
  }

  const apiKey = await getActiveApiKey();

  // 2. High-speed Gemini Vision call
  if (base64 && apiKey && apiKey.trim().length > 10) {
    try {
      const body = {
        contents: [
          {
            parts: [
              { text: PROMPT },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.0, // greedy decoding for maximum speed
          maxOutputTokens: 140, // strict token budget to eliminate generation latency
        },
      };

      const primaryUrl = await getWorkingGeminiUrl();
      let response = await fetch(`${primaryUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        response = await fetch(`${FALLBACK_GEMINI_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        response = await fetch(`${LEGACY_GEMINI_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (response.ok) {
        const data = await response.json();
        const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleaned = jsonMatch ? jsonMatch[0] : text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const catId: string = CATEGORY_IDS.includes(parsed.category) ? parsed.category : 'ideas';
        const catLabel = categories.find((c) => c.id === catId)?.label ?? 'Ideas & Notes';

        return {
          category: catId,
          categoryLabel: catLabel,
          intent: parsed.intent || 'Saved for later review',
          summary: parsed.summary || 'Screenshot captured and organized.',
          tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 4) : ['screenshot'],
          isRealAi: true,
        };
      }
    } catch (apiErr) {
      console.warn('Fast vision analysis error, using fallback:', apiErr);
    }
  }

  return smartLocalCategorize(imageUri);
}
