/**
 * String Utilities for MsikaPos
 */

/**
 * Converts a string to sentence case (First letter uppercase, rest lowercase)
 */
export const toSentenceCase = (str: string): string => {
  if (!str) return str;
  // Trim and handle multiple words: first char of whole string upper, rest lower
  const cleaned = str.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};
