import { memo } from "react";

/**
 * Renders Microsoft Fluent Emoji (3D style) as images from GitHub CDN.
 * Falls back to native emoji if not mapped or image fails to load.
 */

// GitHub raw CDN for Microsoft fluentui-emoji repo
const CDN_BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";

// Maps emoji unicode to { folder, file } for the GitHub repo structure
const EMOJI_MAP: Record<string, { folder: string; file: string }> = {};

// Helper to register emoji mappings
function reg(emoji: string, folder: string, file?: string) {
  EMOJI_MAP[emoji] = {
    folder,
    file: file || folder.toLowerCase().replace(/ /g, "_") + "_3d.png",
  };
}

// Smileys & Emotion
reg("😀", "Grinning face");
reg("😃", "Grinning face with big eyes");
reg("😄", "Grinning face with smiling eyes");
reg("😁", "Beaming face with smiling eyes");
reg("😆", "Grinning squinting face");
reg("😅", "Grinning face with sweat");
reg("🤣", "Rolling on the floor laughing");
reg("😂", "Face with tears of joy");
reg("🙂", "Slightly smiling face");
reg("🙃", "Upside-down face");
reg("😉", "Winking face");
reg("😊", "Smiling face with smiling eyes");
reg("😇", "Smiling face with halo");
reg("🥰", "Smiling face with hearts");
reg("😍", "Smiling face with heart-eyes");
reg("🤩", "Star-struck");
reg("😘", "Face blowing a kiss");
reg("😗", "Kissing face");
reg("😚", "Kissing face with closed eyes");
reg("😙", "Kissing face with smiling eyes");
reg("🥲", "Smiling face with tear");
reg("😋", "Face savoring food");
reg("😛", "Face with tongue");
reg("😜", "Winking face with tongue");
reg("🤪", "Zany face");
reg("😝", "Squinting face with tongue");
reg("🤑", "Money-mouth face");
reg("🤗", "Smiling face with open hands", "hugging_face_3d.png");
reg("🤭", "Face with hand over mouth");
reg("🤫", "Shushing face");
reg("🤔", "Thinking face");
reg("🤐", "Zipper-mouth face");
reg("🤨", "Face with raised eyebrow");
reg("😐", "Neutral face");
reg("😑", "Expressionless face");
reg("😶", "Face without mouth");
reg("😏", "Smirking face");
reg("😒", "Unamused face");
reg("🙄", "Face with rolling eyes");
reg("😬", "Grimacing face");
reg("😌", "Relieved face");
reg("😔", "Pensive face");
reg("😪", "Sleepy face");
reg("🤤", "Drooling face");
reg("😴", "Sleeping face");
reg("😷", "Face with medical mask");
reg("🤒", "Face with thermometer");
reg("🤕", "Face with head-bandage");
reg("🤢", "Nauseated face");
reg("🤮", "Face vomiting");
reg("🥵", "Hot face");
reg("🥶", "Cold face");
reg("🥴", "Woozy face");
reg("😵", "Face with crossed-out eyes", "face_with_crossed-out_eyes_3d.png");
reg("🤯", "Exploding head");
reg("🤠", "Cowboy hat face");
reg("🥳", "Partying face");
reg("😎", "Smiling face with sunglasses");
reg("🤓", "Nerd face");
reg("🧐", "Face with monocle");
reg("😕", "Confused face");
reg("😟", "Worried face");
reg("🙁", "Slightly frowning face");
reg("😮", "Face with open mouth");
reg("😯", "Hushed face");
reg("😲", "Astonished face");
reg("😳", "Flushed face");
reg("🥺", "Pleading face");
reg("😦", "Frowning face with open mouth");
reg("😧", "Anguished face");
reg("😨", "Fearful face");
reg("😰", "Anxious face with sweat");
reg("😥", "Sad but relieved face");
reg("😢", "Crying face");
reg("😭", "Loudly crying face");
reg("😱", "Face screaming in fear");
reg("😖", "Confounded face");
reg("😣", "Persevering face");
reg("😞", "Disappointed face");
reg("😓", "Downcast face with sweat");
reg("😩", "Weary face");
reg("😫", "Tired face");
reg("🥱", "Yawning face");
reg("😤", "Face with steam from nose");
reg("😡", "Enraged face", "pouting_face_3d.png");
reg("😠", "Angry face");
reg("🤬", "Face with symbols on mouth");
reg("😈", "Smiling face with horns");
reg("👿", "Angry face with horns");
reg("💀", "Skull");
reg("💩", "Pile of poo");
reg("🤡", "Clown face");
reg("👹", "Ogre");
reg("👺", "Goblin");
reg("👻", "Ghost");
reg("👽", "Alien");
reg("👾", "Alien monster");
reg("🤖", "Robot");

// Cats
reg("😺", "Grinning cat");
reg("😸", "Grinning cat with smiling eyes");
reg("😹", "Cat with tears of joy");
reg("😻", "Smiling cat with heart-eyes");
reg("😼", "Cat with wry smile");
reg("😽", "Kissing cat");
reg("🙀", "Weary cat");
reg("😿", "Crying cat");
reg("😾", "Pouting cat");

// Animals
reg("🐶", "Dog face");
reg("🐱", "Cat face");
reg("🐭", "Mouse face");
reg("🐹", "Hamster");
reg("🐰", "Rabbit face");
reg("🦊", "Fox");
reg("🐻", "Bear");
reg("🐼", "Panda");
reg("🐨", "Koala");
reg("🐯", "Tiger face");
reg("🦁", "Lion");
reg("🐮", "Cow face");
reg("🐷", "Pig face");
reg("🐸", "Frog");
reg("🐵", "Monkey face");
reg("🙈", "See-no-evil monkey");
reg("🙉", "Hear-no-evil monkey");
reg("🙊", "Speak-no-evil monkey");
reg("🐔", "Chicken");
reg("🐧", "Penguin");
reg("🐦", "Bird");
reg("🦆", "Duck");
reg("🦅", "Eagle");
reg("🦉", "Owl");
reg("🦇", "Bat");
reg("🐺", "Wolf");
reg("🐴", "Horse face");
reg("🦄", "Unicorn");
reg("🐝", "Honeybee");
reg("🦋", "Butterfly");
reg("🐌", "Snail");
reg("🐞", "Lady beetle");
reg("🐜", "Ant");

// Hearts
reg("❤️", "Red heart");
reg("🧡", "Orange heart");
reg("💛", "Yellow heart");
reg("💚", "Green heart");
reg("💙", "Blue heart");
reg("💜", "Purple heart");
reg("🖤", "Black heart");
reg("🤍", "White heart");
reg("🤎", "Brown heart");
reg("💔", "Broken heart");
reg("💕", "Two hearts");
reg("💞", "Revolving hearts");
reg("💓", "Beating heart");
reg("💗", "Growing heart");
reg("💖", "Sparkling heart");
reg("💘", "Heart with arrow");
reg("💝", "Heart with ribbon");

// Symbols & Nature
reg("⭐", "Star");
reg("🌟", "Glowing star");
reg("✨", "Sparkles");
reg("⚡", "High voltage");
reg("🔥", "Fire");
reg("💥", "Collision");
reg("🎉", "Party popper");
reg("🎊", "Confetti ball");
reg("🎈", "Balloon");
reg("🎯", "Bullseye", "direct_hit_3d.png");
reg("🎮", "Video game");
reg("🎲", "Game die");
reg("🎵", "Musical note");
reg("🎶", "Musical notes");
reg("🎸", "Guitar");
reg("🎹", "Musical keyboard");
reg("🎺", "Trumpet");
reg("🎻", "Violin");
reg("🥁", "Drum");
reg("🎤", "Microphone");

// Objects
reg("💻", "Laptop");
reg("📱", "Mobile phone");
reg("💡", "Light bulb");
reg("🔑", "Key");
reg("🔒", "Locked");
reg("📚", "Books");
reg("📖", "Open book");
reg("✏️", "Pencil");
reg("📝", "Memo");
reg("📌", "Pushpin");
reg("📎", "Paperclip");
reg("📊", "Bar chart");
reg("📈", "Chart increasing");
reg("📉", "Chart decreasing");

// Transport
reg("🚀", "Rocket");
reg("✈️", "Airplane");
reg("🚗", "Automobile");
reg("🚕", "Taxi");
reg("🚙", "Sport utility vehicle");
reg("🏠", "House");
reg("🏢", "Office building");
reg("🏰", "Castle");
reg("🌍", "Globe showing Europe-Africa");
reg("🌎", "Globe showing Americas");
reg("🌏", "Globe showing Asia-Australia");
reg("🌈", "Rainbow");
reg("☀️", "Sun");
reg("🌙", "Crescent moon");
reg("☁️", "Cloud");

// Food
reg("🍕", "Pizza");
reg("🍔", "Hamburger");
reg("🍟", "French fries");
reg("🌭", "Hot dog");
reg("🍿", "Popcorn");
reg("🍳", "Cooking");
reg("🍗", "Poultry leg");
reg("🍖", "Meat on bone");
reg("🌮", "Taco");
reg("🌯", "Burrito");
reg("🍝", "Spaghetti");
reg("🍜", "Steaming bowl");
reg("🍲", "Pot of food");
reg("🍣", "Sushi");
reg("🍱", "Bento box");
reg("🍩", "Doughnut");
reg("🍪", "Cookie");
reg("🎂", "Birthday cake");
reg("🍰", "Shortcake");
reg("🧁", "Cupcake");
reg("🍫", "Chocolate bar");
reg("🍬", "Candy");
reg("🍭", "Lollipop");
reg("🍯", "Honey pot");
reg("☕", "Hot beverage");
reg("🍵", "Teacup without handle");
reg("🍺", "Beer mug");
reg("🍻", "Clinking beer mugs");
reg("🥂", "Clinking glasses");
reg("🍷", "Wine glass");
reg("🍾", "Bottle with popping cork");

// Hands
reg("👍", "Thumbs up");
reg("👎", "Thumbs down");
reg("👊", "Oncoming fist");
reg("✊", "Raised fist");
reg("👏", "Clapping hands");
reg("🙌", "Raising hands");
reg("🙏", "Folded hands");
reg("✌️", "Victory hand");
reg("👋", "Waving hand");
reg("💪", "Flexed biceps");

// Awards
reg("🏆", "Trophy");
reg("🥇", "1st place medal");
reg("🥈", "2nd place medal");
reg("🥉", "3rd place medal");
reg("🏅", "Sports medal");
reg("🎨", "Artist palette");
reg("🎬", "Clapper board");
reg("🎧", "Headphone");

// Special for categories
reg("🩺", "Stethoscope");
reg("🧠", "Brain");
reg("💼", "Briefcase");
reg("💰", "Money bag");
reg("🍽️", "Fork and knife with plate");

// Additional animals
reg("🐢", "Turtle");
reg("🐍", "Snake");
reg("🦎", "Lizard");
reg("🐙", "Octopus");
reg("🐬", "Dolphin");
reg("🐳", "Spouting whale");
reg("🐋", "Whale");
reg("🦈", "Shark");
reg("🐊", "Crocodile");
reg("🐅", "Tiger");
reg("🐆", "Leopard");
reg("🦍", "Gorilla");
reg("🐘", "Elephant");
reg("🐪", "Camel");
reg("🦒", "Giraffe");
reg("🐎", "Horse");
reg("🐖", "Pig");
reg("🐑", "Ewe");
reg("🐐", "Goat");
reg("🦌", "Deer");
reg("🐕", "Dog");
reg("🐩", "Poodle");
reg("🐈", "Cat");
reg("🐓", "Rooster");
reg("🦚", "Peacock");
reg("🦜", "Parrot");
reg("🦢", "Swan");
reg("🦩", "Flamingo");
reg("🐇", "Rabbit");
reg("🦔", "Hedgehog");

// Nature & Plants
reg("🌸", "Cherry blossom");
reg("🌹", "Rose");
reg("🌺", "Hibiscus");
reg("🌻", "Sunflower");
reg("🌼", "Blossom");
reg("🌷", "Tulip");
reg("🌱", "Seedling");
reg("🌲", "Evergreen tree");
reg("🌳", "Deciduous tree");
reg("🌴", "Palm tree");
reg("🌵", "Cactus");
reg("🍀", "Four leaf clover");
reg("🍁", "Maple leaf");
reg("🍂", "Fallen leaf");
reg("🍃", "Leaf fluttering in wind");
reg("🍄", "Mushroom");
reg("🌊", "Water wave");
reg("💐", "Bouquet");

// Weather
reg("🌚", "New moon face");
reg("🌝", "Full moon face");
reg("🌞", "Sun with face");
reg("❄️", "Snowflake");
reg("☃️", "Snowman");
reg("⛄", "Snowman without snow");

// Sports & Activities
reg("⚽", "Soccer ball");
reg("🏀", "Basketball");
reg("🏈", "American football");
reg("⚾", "Baseball");
reg("🎾", "Tennis");
reg("🏐", "Volleyball");
reg("🎱", "Pool 8 ball");
reg("🏓", "Ping pong");
reg("🏸", "Badminton");
reg("🥊", "Boxing glove");
reg("🥋", "Martial arts uniform");
reg("🎿", "Skis");

// Tech extras
reg("⌨️", "Keyboard");
reg("🖥️", "Desktop computer");
reg("🔍", "Magnifying glass tilted left");
reg("🔬", "Microscope");
reg("🔭", "Telescope");
reg("💾", "Floppy disk");
reg("📷", "Camera");
reg("📹", "Video camera");
reg("📺", "Television");
reg("📻", "Radio");
reg("🔧", "Wrench");
reg("🔨", "Hammer");
reg("⚙️", "Gear");
reg("💊", "Pill");
reg("🧬", "Dna");
reg("🧪", "Test tube");
reg("👑", "Crown");
reg("🎩", "Top hat");
reg("💎", "Gem stone");
reg("💍", "Ring");
reg("👓", "Glasses");
reg("🕶️", "Sunglasses");

// Transport extras
reg("🏍️", "Motorcycle");
reg("🛵", "Motor scooter");
reg("🚲", "Bicycle");
reg("🚂", "Locomotive");
reg("🛳️", "Passenger ship");
reg("⛵", "Sailboat");
reg("🏡", "House with garden");
reg("🏥", "Hospital");
reg("🏦", "Bank");
reg("🏪", "Convenience store");
reg("🏫", "School");
reg("🏭", "Factory");
reg("🏯", "Japanese castle");
reg("⛪", "Church");

// Food extras
reg("🍎", "Red apple");
reg("🍏", "Green apple");
reg("🍊", "Tangerine");
reg("🍋", "Lemon");
reg("🍌", "Banana");
reg("🍉", "Watermelon");
reg("🍇", "Grapes");
reg("🍓", "Strawberry");
reg("🍒", "Cherries");
reg("🍑", "Peach");
reg("🍍", "Pineapple");
reg("🥝", "Kiwi fruit");
reg("🍅", "Tomato");
reg("🍆", "Eggplant");
reg("🥑", "Avocado");
reg("🥦", "Broccoli");
reg("🌽", "Ear of corn");
reg("🥕", "Carrot");
reg("🧀", "Cheese wedge");
reg("🍞", "Bread");
reg("🥐", "Croissant");
reg("🍤", "Fried shrimp");
reg("🍧", "Shaved ice");
reg("🍨", "Ice cream");
reg("🍦", "Soft ice cream");
reg("🍮", "Custard");
reg("🍶", "Sake");
reg("🍸", "Cocktail glass");
reg("🍹", "Tropical drink");
reg("🧊", "Ice");

// Gestures extras
reg("🤏", "Pinching hand");
reg("👈", "Backhand index pointing left");
reg("👉", "Backhand index pointing right");
reg("👆", "Backhand index pointing up");
reg("👇", "Backhand index pointing down");
reg("☝️", "Index pointing up");
reg("✋", "Raised hand");
reg("🖖", "Vulcan salute");
reg("🤙", "Call me hand");
reg("🖕", "Middle finger");

// People
reg("👶", "Baby");
reg("💃", "Woman dancing");
reg("🕺", "Man dancing");

// Flags
reg("🏁", "Chequered flag");
reg("🚩", "Triangular flag");
reg("🇧🇷", "Flag Brazil", "flag_brazil_3d.png");

// Celebrations extras
reg("🎁", "Wrapped gift");
reg("🎀", "Ribbon");
reg("🎆", "Fireworks");
reg("🎇", "Sparkler");
reg("🎃", "Jack-o-lantern");
reg("🎄", "Christmas tree");
reg("🔮", "Crystal ball");

interface FluentEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
}

function FluentEmojiInner({ emoji, size = 20, className = "" }: FluentEmojiProps) {
  const mapping = EMOJI_MAP[emoji];

  if (!mapping) {
    return <span className={className} style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>;
  }

  const url = `${CDN_BASE}/${encodeURIComponent(mapping.folder)}/3D/${encodeURIComponent(mapping.file)}`;

  return (
    <img
      src={url}
      alt={emoji}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      loading="eager"
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
