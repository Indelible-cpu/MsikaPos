import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { Lock } from 'lucide-react';

interface FeatureGuardProps {
  featureKey: string;
  requireFullAccess?: boolean;
}

const FeatureGuard: React.FC<FeatureGuardProps> = ({ featureKey, requireFullAccess = false }) => {
  const { canAccess, isReadOnly } = useFeatureAccess();

  const hasAccess = canAccess(featureKey);
  const isStrictlyReadOnly = isReadOnly(featureKey);

  // If requireFullAccess is true, they must have FULL access (not READ_ONLY)
  if (!hasAccess || (requireFullAccess && isStrictlyReadOnly)) {
    return (
      <div className="flex-1 w-full h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-12 h-12 text-destructive" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-4">Access Denied</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          You don't have the required permissions to view this page. If you believe this is a mistake, please contact your administrator.
        </p>
        <button 
          onClick={() => window.history.back()}
          className="px-8 py-3 bg-surface-card border border-surface-border rounded-xl font-bold hover:bg-surface-border/50 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return <Outlet />;
};

export default FeatureGuard;
