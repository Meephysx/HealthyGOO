import React from 'react';
import Navigation from './Navigation';
import AiFab from './AiFab';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showNavigation = true }) => {
  const location = useLocation();
  const showAiFab = location.pathname !== '/ai-chat';

  return (
    <div className="min-h-screen bg-gray-50">
      {showNavigation && <Navigation />}
      <main className={showNavigation ? 'pt-16' : ''}>
        {children}
      </main>
      {showAiFab && <AiFab />}
    </div>
  );
};

export default Layout;