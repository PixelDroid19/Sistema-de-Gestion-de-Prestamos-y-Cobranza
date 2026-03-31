import React from 'react';
import { Shield, Lock, Check } from 'lucide-react';

interface PermissionToggleProps {
  permission: string;
  module?: string;
  description?: string;
  source: 'direct' | 'role';
  granted: boolean;
  onToggle: (granted: boolean) => void;
  compact?: boolean;
}

export default function PermissionToggle({
  permission,
  module,
  description,
  source,
  granted,
  onToggle,
  compact = false,
}: PermissionToggleProps) {
  const handleToggle = () => {
    if (source === 'role') return;
    onToggle(!granted);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
          granted 
            ? 'bg-green-500/10 text-green-600' 
            : 'bg-text-secondary/10 text-text-secondary'
        }`}>
          {granted && <Check size={10} />}
          {permission}
        </span>
        {source === 'role' && (
          <Lock size={10} className="text-text-secondary" aria-label="Heredado del rol" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 border border-border-subtle rounded-xl hover:bg-hover-bg transition-colors">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${granted ? 'text-green-500' : 'text-text-secondary'}`}>
          {source === 'role' ? <Lock size={16} /> : <Shield size={16} />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{permission}</p>
            {source === 'role' ? (
              <span className="text-xs bg-text-secondary/10 text-text-secondary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock size={10} /> heredado
              </span>
            ) : (
              <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Shield size={10} /> directo
              </span>
            )}
            {module && (
              <span className="text-xs bg-bg-base text-text-secondary px-2 py-0.5 rounded-full capitalize">
                {module}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-text-secondary mt-1">{description}</p>
          )}
        </div>
      </div>
      
      <button
        onClick={handleToggle}
        disabled={source === 'role'}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          source === 'role' 
            ? 'bg-bg-base cursor-not-allowed' 
            : granted 
              ? 'bg-green-500' 
              : 'bg-text-secondary/30'
        }`}
        aria-label={source === 'role' ? 'No se puede modificar - heredado del rol' : granted ? 'Revocar permiso' : 'Conceder permiso'}
      >
        <span 
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            granted ? 'translate-x-6' : 'translate-x-1'
          }`} 
        />
      </button>
    </div>
  );
}
