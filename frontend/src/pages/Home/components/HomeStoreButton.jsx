import React from 'react';
import { Apple, Play } from 'lucide-react';

import Button from '@/components/ui/Button';

const STORE_ICON_MAP = {
  apple: Apple,
  play: Play,
};

function HomeStoreButton({ eyebrow, label, platform = 'apple', theme = 'dark', iconFill, className = '' }) {
  const Icon = STORE_ICON_MAP[platform] ?? Apple;
  const iconProps = platform === 'play' ? { size: 24, fill: iconFill ?? 'currentColor' } : { size: 28 };

  return (
    <Button className={`home-store-button home-store-button--${theme} ${className}`.trim()} type="button">
      <Icon {...iconProps} />
      <span className="home-store-button__copy">
        <span className="home-store-button__eyebrow">{eyebrow}</span>
        <span className="home-store-button__label">{label}</span>
      </span>
    </Button>
  );
}

export default HomeStoreButton;