import React from 'react';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';

const Layout = ({ children }) => {
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="main-wrapper">
        <TopHeader />
        <main className="content-area">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
