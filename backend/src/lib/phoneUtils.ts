export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-numeric characters except +
  let clean = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + for logic
  let digits = clean.replace('+', '');

  // Malawi specific logic (+265)
  // If it's a 10 digit number starting with 0 (e.g. 0999123456)
  if (digits.startsWith('0') && digits.length === 10) {
    return `+265${digits.substring(1)}`;
  }

  // If it's a 9 digit number (e.g. 999123456)
  if (digits.length === 9) {
    return `+265${digits}`;
  }

  // If it's already 12 digits starting with 265
  if (digits.startsWith('265') && digits.length === 12) {
    return `+${digits}`;
  }

  return clean;
};

export const isValidMalawianPhone = (phone: string): boolean => {
  if (!phone) return false;
  let clean = phone.replace(/[^\d+]/g, '');
  let digits = clean.replace('+', '');
  
  // Malawi mobile numbers start with 8 or 9 and are 9 digits long (after country code/zero)
  if (digits.startsWith('0') && digits.length === 10) {
    const mobilePart = digits.substring(1);
    return mobilePart.startsWith('8') || mobilePart.startsWith('9');
  }
  
  if (digits.length === 9 && (digits.startsWith('8') || digits.startsWith('9'))) return true;
  
  if (digits.startsWith('265') && digits.length === 12) {
    const mobilePart = digits.substring(3);
    return mobilePart.startsWith('8') || mobilePart.startsWith('9');
  }
  
  return false;
};
