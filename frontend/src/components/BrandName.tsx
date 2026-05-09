import React from 'react';

/**
 * Renders the official MsikaPos brand name with correct colour treatment:
 *   "Msika" → inherits foreground colour (black in light mode, white in dark)
 *   "Pos"   → green-500 (#22c55e)
 */
interface BrandNameProps {
  className?: string;
}

const BrandName: React.FC<BrandNameProps> = ({ className = '' }) => (
  <span className={className}>
    <span className="text-foreground">Msika</span>
    <span className="text-green-500">Pos</span>
  </span>
);

export default BrandName;
