/**
 * Deterministically picks an emoji for a notebook based on its title/sources.
 * Uses keyword matching for common topics and falls back to a hash of the title.
 */

const KEYWORD_MAP: Array<{ keywords: string[]; emoji: string }> = [
  { keywords: ["physics", "физика", "квант", "quantum"], emoji: "⚛️" },
  { keywords: ["chemistry", "химия", "молекул"], emoji: "🧪" },
  { keywords: ["biology", "биология", "клет"], emoji: "🧬" },
  { keywords: ["history", "история", "тарих"], emoji: "🏛️" },
  { keywords: ["math", "матем", "algeb", "geomet"], emoji: "📐" },
  { keywords: ["programming", "code", "код", "програм", "software", "javascript", "python"], emoji: "💻" },
  { keywords: ["finance", "money", "ақша", "финанс", "invest"], emoji: "💰" },
  { keywords: ["health", "densaulyq", "медицин", "medicine"], emoji: "🩺" },
  { keywords: ["music", "музык", "song", "ән"], emoji: "🎵" },
  { keywords: ["film", "movie", "фильм", "video"], emoji: "🎬" },
  { keywords: ["book", "novel", "литератур", "кітап"], emoji: "📖" },
  { keywords: ["recipe", "cooking", "food", "тағам"], emoji: "🍳" },
  { keywords: ["travel", "сапар", "trip"], emoji: "✈️" },
  { keywords: ["business", "startup", "стартап", "бизнес"], emoji: "💼" },
  { keywords: ["legal", "law", "құқық", "юрид"], emoji: "⚖️" },
  { keywords: ["education", "school", "study", "мектеп", "оқу"], emoji: "🎓" },
  { keywords: ["psych", "психолог"], emoji: "🧠" },
  { keywords: ["sport", "спорт", "football", "basketball"], emoji: "⚽" },
  { keywords: ["space", "astro", "ғарыш", "космос"], emoji: "🚀" },
  { keywords: ["art", "өнер", "drawing", "paint"], emoji: "🎨" },
  { keywords: ["news", "жаңалық", "current"], emoji: "📰" },
  { keywords: ["research", "ғылым", "science", "paper"], emoji: "🔬" },
  { keywords: ["ai", "artificial", "machine learning", "ml ", "neural", "жасанды"], emoji: "🤖" },
  { keywords: ["language", "тіл", "linguistic"], emoji: "🗣️" },
  { keywords: ["meeting", "notes", "minutes"], emoji: "📝" },
  { keywords: ["project", "жоба", "plan"], emoji: "📋" },
  { keywords: ["politics", "саясат", "election"], emoji: "🏛️" },
  { keywords: ["climate", "environment", "экология"], emoji: "🌍" },
];

const FALLBACK = [
  "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚", "📖",
  "🗂️", "🗃️", "🗄️", "📁", "📂", "🧾", "🔖", "🔎", "💡",
  "🌟", "✨", "🌱", "🌳", "🌊", "⛰️", "🏔️", "🌌",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickEmoji(title: string, extraText = ""): string {
  const haystack = (title + " " + extraText).toLowerCase();
  for (const { keywords, emoji } of KEYWORD_MAP) {
    if (keywords.some((k) => haystack.includes(k))) return emoji;
  }
  return FALLBACK[hashString(title || "n") % FALLBACK.length];
}

export const COMMON_EMOJIS = [
  "📓", "📔", "📒", "📕", "📗", "📘", "📙", "📚",
  "💻", "🧪", "🧬", "📐", "⚛️", "🔬", "🩺", "🧠",
  "🎓", "🎨", "🎵", "🎬", "📖", "📝", "💡", "🌟",
  "🚀", "🌍", "🌌", "✨", "💼", "⚖️", "🌱", "🌳",
  "🤖", "🗣️", "🍳", "✈️", "⚽", "📰", "📋", "🔖",
];
