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

  return clean; // If not valid malawian format, return whatever was input so validator can catch it
};

export const isValidMalawianPhone = (phone: string): boolean => {
  if (!phone) return false;
  let clean = phone.replace(/[^\d+]/g, '');
  let digits = clean.replace('+', '');
  
  if (digits.startsWith('0') && digits.length === 10) return true;
  if (digits.length === 9 && (digits.startsWith('8') || digits.startsWith('9'))) return true;
  if (digits.startsWith('265') && digits.length === 12) return true;
  
  return false;
};

export const formatCurrency = (amount: number): string => {
  return `MK${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
