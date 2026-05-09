import React from 'react';

/**
 * Renders the official MsikaPos brand name with correct colour treatment:
 *   "Msika" → black (foreground)
 *   "Pos"   → green (#22c55e  = Tailwind green-500)
 */
interface BrandNameProps {
  className?: string;
}

const BrandName: React.FC<BrandNameProps> = ({ className = '' }) => (
  <span className={className}>
    <span style={{ color: 'inherit' }}>Msika</span>
    <span style={{ color: '#22c55e' }}>Pos</span>
  </span>
);

export default BrandName;
