import React from 'react';

function HomeDeviceFrame({ className = '', screenClassName = '', children }) {
  return (
    <div className={`phone-mockup ${className}`.trim()}>
      <div className="phone-notch" />
      <div className={`phone-screen ${screenClassName}`.trim()}>{children}</div>
    </div>
  );
}

export default HomeDeviceFrame;