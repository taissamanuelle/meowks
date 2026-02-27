import { memo } from "react";

/**
 * Maps unicode emoji to Microsoft Fluent Emoji CDN URLs.
 * Uses the "3D" style from Microsoft's fluentui-emoji GitHub repo via CDN.
 * 
 * Usage: <FluentEmoji emoji="😀" size={24} />
 */

function emojiToCodePoints(emoji: string): string {
  const codePoints: string[] = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp && cp !== 0xfe0f) { // skip variation selector
      codePoints.push(cp.toString(16));
    }
  }
  return codePoints.join("-");
}

// CDN base for Fluent Emoji (3D style) — uses jsdelivr mirror of the npm package
const CDN_BASE = "https://cdn.jsdelivr.net/npm/fluentui-emoji@latest/icons";

// Mapping from emoji to their Fluent Emoji asset folder names
const EMOJI_SLUG_MAP: Record<string, string> = {
  "😀": "grinning face",
  "😃": "grinning face with big eyes",
  "😄": "grinning face with smiling eyes",
  "😁": "beaming face with smiling eyes",
  "😆": "grinning squinting face",
  "😅": "grinning face with sweat",
  "🤣": "rolling on the floor laughing",
  "😂": "face with tears of joy",
  "🙂": "slightly smiling face",
  "🙃": "upside-down face",
  "😉": "winking face",
  "😊": "smiling face with smiling eyes",
  "😇": "smiling face with halo",
  "🥰": "smiling face with hearts",
  "😍": "smiling face with heart-eyes",
  "🤩": "star-struck",
  "😘": "face blowing a kiss",
  "😗": "kissing face",
  "😚": "kissing face with closed eyes",
  "😙": "kissing face with smiling eyes",
  "🥲": "smiling face with tear",
  "😋": "face savoring food",
  "😛": "face with tongue",
  "😜": "winking face with tongue",
  "🤪": "zany face",
  "😝": "squinting face with tongue",
  "🤑": "money-mouth face",
  "🤗": "smiling face with open hands",
  "🤭": "face with hand over mouth",
  "🤫": "shushing face",
  "🤔": "thinking face",
  "🤐": "zipper-mouth face",
  "🤨": "face with raised eyebrow",
  "😐": "neutral face",
  "😑": "expressionless face",
  "😶": "face without mouth",
  "😏": "smirking face",
  "😒": "unamused face",
  "🙄": "face with rolling eyes",
  "😬": "grimacing face",
  "😌": "relieved face",
  "😔": "pensive face",
  "😪": "sleepy face",
  "🤤": "drooling face",
  "😴": "sleeping face",
  "😷": "face with medical mask",
  "🤒": "face with thermometer",
  "🤕": "face with head-bandage",
  "🤢": "nauseated face",
  "🤮": "face vomiting",
  "🥵": "hot face",
  "🥶": "cold face",
  "🥴": "woozy face",
  "😵": "face with crossed-out eyes",
  "🤯": "exploding head",
  "🤠": "cowboy hat face",
  "🥳": "partying face",
  "😎": "smiling face with sunglasses",
  "🤓": "nerd face",
  "🧐": "face with monocle",
  "😕": "confused face",
  "😟": "worried face",
  "🙁": "slightly frowning face",
  "😮": "face with open mouth",
  "😯": "hushed face",
  "😲": "astonished face",
  "😳": "flushed face",
  "🥺": "pleading face",
  "😦": "frowning face with open mouth",
  "😧": "anguished face",
  "😨": "fearful face",
  "😰": "anxious face with sweat",
  "😥": "sad but relieved face",
  "😢": "crying face",
  "😭": "loudly crying face",
  "😱": "face screaming in fear",
  "😖": "confounded face",
  "😣": "persevering face",
  "😞": "disappointed face",
  "😓": "downcast face with sweat",
  "😩": "weary face",
  "😫": "tired face",
  "🥱": "yawning face",
  "😤": "face with steam from nose",
  "😡": "enraged face",
  "😠": "angry face",
  "🤬": "face with symbols on mouth",
  "😈": "smiling face with horns",
  "👿": "angry face with horns",
  "💀": "skull",
  "💩": "pile of poo",
  "🤡": "clown face",
  "👹": "ogre",
  "👺": "goblin",
  "👻": "ghost",
  "👽": "alien",
  "👾": "alien monster",
  "🤖": "robot",
  "😺": "grinning cat",
  "😸": "grinning cat with smiling eyes",
  "😹": "cat with tears of joy",
  "😻": "smiling cat with heart-eyes",
  "😼": "cat with wry smile",
  "😽": "kissing cat",
  "🙀": "weary cat",
  "😿": "crying cat",
  "😾": "pouting cat",
  "🐶": "dog face",
  "🐱": "cat face",
  "🐭": "mouse face",
  "🐹": "hamster",
  "🐰": "rabbit face",
  "🦊": "fox",
  "🐻": "bear",
  "🐼": "panda",
  "🐨": "koala",
  "🐯": "tiger face",
  "🦁": "lion",
  "🐮": "cow face",
  "🐷": "pig face",
  "🐸": "frog",
  "🐵": "monkey face",
  "🙈": "see-no-evil monkey",
  "🙉": "hear-no-evil monkey",
  "🙊": "speak-no-evil monkey",
  "🐔": "chicken",
  "🐧": "penguin",
  "🐦": "bird",
  "🦆": "duck",
  "🦅": "eagle",
  "🦉": "owl",
  "🦇": "bat",
  "🐺": "wolf",
  "🐴": "horse face",
  "🦄": "unicorn",
  "🐝": "honeybee",
  "🦋": "butterfly",
  "🐌": "snail",
  "🐞": "lady beetle",
  "🐜": "ant",
  "❤️": "red heart",
  "🧡": "orange heart",
  "💛": "yellow heart",
  "💚": "green heart",
  "💙": "blue heart",
  "💜": "purple heart",
  "🖤": "black heart",
  "🤍": "white heart",
  "🤎": "brown heart",
  "💔": "broken heart",
  "💕": "two hearts",
  "💞": "revolving hearts",
  "💓": "beating heart",
  "💗": "growing heart",
  "💖": "sparkling heart",
  "💘": "heart with arrow",
  "💝": "heart with ribbon",
  "⭐": "star",
  "🌟": "glowing star",
  "✨": "sparkles",
  "⚡": "high voltage",
  "🔥": "fire",
  "💥": "collision",
  "🎉": "party popper",
  "🎊": "confetti ball",
  "🎈": "balloon",
  "🎯": "bullseye",
  "🎮": "video game",
  "🎲": "game die",
  "🎵": "musical note",
  "🎶": "musical notes",
  "🎸": "guitar",
  "🎹": "musical keyboard",
  "🎺": "trumpet",
  "🎻": "violin",
  "🥁": "drum",
  "🎤": "microphone",
  "💻": "laptop",
  "📱": "mobile phone",
  "💡": "light bulb",
  "🔑": "key",
  "🔒": "locked",
  "📚": "books",
  "📖": "open book",
  "✏️": "pencil",
  "📝": "memo",
  "📌": "pushpin",
  "📎": "paperclip",
  "📊": "bar chart",
  "📈": "chart increasing",
  "📉": "chart decreasing",
  "🚀": "rocket",
  "✈️": "airplane",
  "🚗": "automobile",
  "🚕": "taxi",
  "🚙": "sport utility vehicle",
  "🏠": "house",
  "🏢": "office building",
  "🏰": "castle",
  "🌍": "globe showing europe-africa",
  "🌎": "globe showing americas",
  "🌏": "globe showing asia-australia",
  "🌈": "rainbow",
  "☀️": "sun",
  "🌙": "crescent moon",
  "☁️": "cloud",
  "🍕": "pizza",
  "🍔": "hamburger",
  "🍟": "french fries",
  "🌭": "hot dog",
  "🍿": "popcorn",
  "🍳": "cooking",
  "🍗": "poultry leg",
  "🍖": "meat on bone",
  "🌮": "taco",
  "🌯": "burrito",
  "🍝": "spaghetti",
  "🍜": "steaming bowl",
  "🍲": "pot of food",
  "🍛": "curry rice",
  "🍣": "sushi",
  "🍱": "bento box",
  "🍩": "doughnut",
  "🍪": "cookie",
  "🎂": "birthday cake",
  "🍰": "shortcake",
  "🧁": "cupcake",
  "🍫": "chocolate bar",
  "🍬": "candy",
  "🍭": "lollipop",
  "🍮": "custard",
  "🍯": "honey pot",
  "☕": "hot beverage",
  "🍵": "teacup without handle",
  "🍺": "beer mug",
  "🍻": "clinking beer mugs",
  "🥂": "clinking glasses",
  "🍷": "wine glass",
  "🍾": "bottle with popping cork",
  "👍": "thumbs up",
  "👎": "thumbs down",
  "👊": "oncoming fist",
  "✊": "raised fist",
  "👏": "clapping hands",
  "🙌": "raising hands",
  "🙏": "folded hands",
  "✌️": "victory hand",
  "👋": "waving hand",
  "💪": "flexed biceps",
  "🏆": "trophy",
  "🥇": "1st place medal",
  "🥈": "2nd place medal",
  "🥉": "3rd place medal",
  "🏅": "sports medal",
  "🎨": "artist palette",
  "🎬": "clapper board",
  "🎧": "headphone",
  "🩺": "stethoscope",
  "🧠": "brain",
  "💼": "briefcase",
  "💰": "money bag",
  "🍽️": "fork and knife with plate",
  "💵": "dollar banknote",
};

function slugToPath(slug: string): string {
  return slug.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

interface FluentEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

function FluentEmojiInner({ emoji, size = 20, className = "" }: FluentEmojiProps) {
  const slug = EMOJI_SLUG_MAP[emoji];
  
  if (!slug) {
    // Fallback to native emoji
    return <span className={className} style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>;
  }

  const folderName = slugToPath(slug);
  const url = `${CDN_BASE}/${encodeURIComponent(folderName)}/3D/${encodeURIComponent(folderName.toLowerCase().replace(/ /g, "_"))}_3d.png`;

  return (
    <img
      src={url}
      alt={emoji}
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={(e) => {
        // Fallback to native emoji on load failure
        const span = document.createElement("span");
        span.textContent = emoji;
        span.style.fontSize = `${size}px`;
        span.style.lineHeight = "1";
        span.className = className;
        e.currentTarget.replaceWith(span);
      }}
    />
  );
}

export const FluentEmoji = memo(FluentEmojiInner);
