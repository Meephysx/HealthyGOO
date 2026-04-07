import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  User, 
  Calendar, 
  Search, 
  TrendingUp,
  Heart,
  Dumbbell
} from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();

  // Menu bawah sekarang hanya 5 (Tanpa Search)
  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Home' },
    { path: '/meals', icon: Calendar, label: 'Meals' }, 
    { path: '/exercises', icon: Dumbbell, label: 'Workouts' },
    { path: '/progress', icon: TrendingUp, label: 'Progress' },
    { path: '/profile', icon: User, label: 'Profile' }
  ];

  return (
    <>
      {/* TOP BAR */}
      <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 h-16 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          
          {/* SISI KIRI: Logo & Nama */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <Heart className="h-7 w-7 text-green-600 fill-green-600" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">
              HealthyGO
            </span>
          </Link>

          {/* SISI KANAN: Icon Search (Mobile) & Menu (Desktop) */}
          <div className="flex items-center space-x-4">
            {/* Icon Search di Kanan Atas (Hanya muncul di Mobile) */}
            <Link 
              to="/food-search" 
              className={`md:hidden p-2 rounded-full transition-colors ${
                location.pathname === '/food-search' 
                ? 'bg-green-50 text-green-600' 
                : 'text-gray-500'
              }`}
            >
              <Search className="h-6 w-6" />
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-6">
              {navItems.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`text-sm font-medium transition-colors hover:text-green-600 ${
                    location.pathname === path ? 'text-green-600' : 'text-gray-500'
                  }`}
                >
                  {label}
                </Link>
              ))}
              {/* Search juga ada di desktop menu */}
              <Link
                to="/food-search"
                className={`text-sm font-medium transition-colors hover:text-green-600 ${
                  location.pathname === '/food-search' ? 'text-green-600' : 'text-gray-500'
                }`}
              >
                Search
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* BOTTOM NAVIGATION (Hanya 5 Item) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
                  isActive ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                <Icon 
                  className={`h-5 w-5 ${isActive ? 'scale-110' : ''}`} 
                  fill={isActive ? "currentColor" : "none"}
                />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Navigation;