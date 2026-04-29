export interface DiscountableProduct {
  sellPrice: number;
  discount?: number; // legacy
  discountType?: 'PERCENTAGE' | 'FIXED' | string;
  discountValue?: number;
  discountStartDate?: string;
  discountEndDate?: string;
}

export function calculateEffectiveDiscount(product: DiscountableProduct): { 
  hasDiscount: boolean; 
  discountAmount: number; 
  finalPrice: number;
  badgeText: string;
} {
  const sellPrice = Number(product.sellPrice) || 0;
  
  const now = new Date();
  const start = product.discountStartDate ? new Date(product.discountStartDate) : null;
  const end = product.discountEndDate ? new Date(product.discountEndDate) : null;

  // Check date validity
  if (start && now < start) return { hasDiscount: false, discountAmount: 0, finalPrice: sellPrice, badgeText: '' };
  if (end && now > end) {
    // Make sure we include the end date entirely (e.g., until 23:59:59)
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (now > endOfDay) return { hasDiscount: false, discountAmount: 0, finalPrice: sellPrice, badgeText: '' };
  }

  const discountType = product.discountType || 'PERCENTAGE';
  const discountValue = Number(product.discountValue) || Number(product.discount) || 0;

  if (discountValue <= 0) {
    return { hasDiscount: false, discountAmount: 0, finalPrice: sellPrice, badgeText: '' };
  }

  let discountAmount = 0;
  let badgeText = '';

  if (discountType === 'PERCENTAGE') {
    discountAmount = sellPrice * (Math.min(100, discountValue) / 100);
    badgeText = `-${discountValue}%`;
  } else if (discountType === 'FIXED') {
    discountAmount = Math.min(sellPrice, discountValue); // Discount cannot exceed price
    badgeText = `Save MK${discountAmount.toLocaleString()}`;
  }

  const finalPrice = Math.max(0, sellPrice - discountAmount);

  return {
    hasDiscount: discountAmount > 0,
    discountAmount,
    finalPrice,
    badgeText
  };
}
