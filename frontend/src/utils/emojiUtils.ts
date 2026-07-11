/* eslint-disable security/detect-object-injection -- Safe array access with validated emoji index */
/**
 * Emoji Avatar Utility
 * Handles emoji selection and display for user avatars
 */

// Comprehensive list of person and animal emojis for profile pictures
export const PROFILE_EMOJIS = [
  // Basic faces and people
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', 
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
  '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
  
  // People and professions
  '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓',
  '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🙇', '🤦',
  '🤷', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👳', '👲', '🧕',
  '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙',
  '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '🙏',
  
  // People with activities and professions
  '🧑‍⚕️', '👨‍⚕️', '👩‍⚕️', '🧑‍🌾', '👨‍🌾', '👩‍🌾', '🧑‍🍳', '👨‍🍳', '👩‍🍳',
  '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧑‍🎤', '👨‍🎤', '👩‍🎤', '🧑‍🏫', '👨‍🏫', '👩‍🏫',
  '🧑‍🏭', '👨‍🏭', '👩‍🏭', '🧑‍💻', '👨‍💻', '👩‍💻', '🧑‍💼', '👨‍💼', '👩‍💼',
  '🧑‍🔧', '👨‍🔧', '👩‍🔧', '🧑‍🔬', '👨‍🔬', '👩‍🔬', '🧑‍🎨', '👨‍🎨', '👩‍🎨',
  '🧑‍🚒', '👨‍🚒', '👩‍🚒', '🧑‍✈️', '👨‍✈️', '👩‍✈️', '🧑‍🚀', '👨‍🚀', '👩‍🚀',
  '🧑‍⚖️', '👨‍⚖️', '👩‍⚖️', '🧑‍🦱', '👨‍🦱', '👩‍🦱', '🧑‍🦰', '👨‍🦰', '👩‍🦰',
  '🧑‍🦳', '👨‍🦳', '👩‍🦳', '🧑‍🦲', '👨‍🦲', '👩‍🦲',
  
  // Animals - mammals
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
  '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
  '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
  '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
  
  // Sea creatures
  '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
  '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦏', '🦛', '🐘', '🦒',
  '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐',
  '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚',
  '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦫',
  '🐿️', '🦔',
  
  // More animals and creatures
  '🐲', '🐉', '🦕', '🦖', '🐳', '🐋', '🐬', '🐟', '🐠', '🐡',
  '🦈', '🐙', '🦑', '🐚', '🦪', '🦀', '🦞', '🦐', '🐌', '🦋',
  '🐛', '🐜', '🐝', '🐞', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎'
];

/**
 * Get all available emoji options for user selection
 * Returns the complete list of person and animal emojis
 */
export function getAllEmojiOptions(): string[] {
  return PROFILE_EMOJIS;
}

/**
 * Check if a string is a valid emoji avatar
 */
export function isValidEmojiAvatar(emoji: string): boolean {
  return PROFILE_EMOJIS.includes(emoji);
}

/**
 * Format emoji avatar for display
 * Ensures consistent sizing and fallback
 */
export function formatEmojiAvatar(avatar: string | null | undefined, size: 'sm' | 'md' | 'lg' | 'xl' = 'md'): {
  emoji: string;
  isEmoji: boolean;
  className: string;
} {
  // Extract emoji from URL format (emoji:😀) or use direct emoji
  let actualEmoji = avatar;
  if (avatar?.startsWith('emoji:')) {
    actualEmoji = avatar.replace('emoji:', '');
  }
  
  const isEmoji = actualEmoji && PROFILE_EMOJIS.includes(actualEmoji);
  
  const sizeClasses = {
    sm: 'text-lg', // ~18px
    md: 'text-2xl', // ~24px
    lg: 'text-display-lg', // 34px
    xl: 'text-display-xl', // 40px
  };
  
  return {
    emoji: isEmoji && actualEmoji ? actualEmoji : '👤', // Default user icon
    isEmoji: !!isEmoji,
    className: `${sizeClasses[size]} select-none`,
  };
}

/**
 * Extract emoji from avatar URL
 */
export function extractEmojiFromUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) {return null;}
  
  if (avatarUrl.startsWith('emoji:')) {
    const emoji = avatarUrl.replace('emoji:', '');
    return isValidEmojiAvatar(emoji) ? emoji : null;
  }
  
  return null;
}