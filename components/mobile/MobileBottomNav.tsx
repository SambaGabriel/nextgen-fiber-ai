import React, { useEffect, useState } from 'react';
import {
  Home,
  Briefcase,
  PlusCircle,
  MessageCircle,
  User,
  Settings,
  DollarSign,
  LayoutDashboard,
  ClipboardList
} from 'lucide-react';
import { ViewState, User as UserType } from '../../types';

interface MobileBottomNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  user: UserType | null;
  unreadCount?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  view: ViewState;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onChangeView,
  user,
  unreadCount = 0
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile || !user) {
    return null;
  }

  const getNavItems = (): NavItem[] => {
    const role = user.role;

    // LINEMAN role navigation
    if (role === 'LINEMAN') {
      return [
        {
          id: 'home',
          label: 'Home',
          icon: <Home size={24} />,
          view: ViewState.DASHBOARD
        },
        {
          id: 'my-jobs',
          label: 'My Jobs',
          icon: <Briefcase size={24} />,
          view: ViewState.MY_JOBS
        },
        {
          id: 'submit',
          label: 'Submit',
          icon: <PlusCircle size={24} />,
          view: ViewState.SUBMIT_WORK
        },
        {
          id: 'chat',
          label: 'Chat',
          icon: <MessageCircle size={24} />,
          view: ViewState.AI_ASSISTANT
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User size={24} />,
          view: ViewState.SETTINGS
        }
      ];
    }

    // FOREMAN role navigation
    if (role === 'FOREMAN') {
      return [
        {
          id: 'home',
          label: 'Home',
          icon: <Home size={24} />,
          view: ViewState.DASHBOARD
        },
        {
          id: 'jobs',
          label: 'Jobs',
          icon: <Briefcase size={24} />,
          view: ViewState.JOBS_ADMIN
        },
        {
          id: 'production',
          label: 'Production',
          icon: <ClipboardList size={24} />,
          view: ViewState.PRODUCTION
        },
        {
          id: 'chat',
          label: 'Chat',
          icon: <MessageCircle size={24} />,
          view: ViewState.AI_ASSISTANT
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User size={24} />,
          view: ViewState.SETTINGS
        }
      ];
    }

    // ADMIN or SUPERVISOR role navigation
    if (role === 'ADMIN' || role === 'SUPERVISOR') {
      return [
        {
          id: 'dashboard',
          label: 'Dashboard',
          icon: <LayoutDashboard size={24} />,
          view: ViewState.DASHBOARD
        },
        {
          id: 'jobs',
          label: 'Jobs',
          icon: <Briefcase size={24} />,
          view: ViewState.JOBS_ADMIN
        },
        {
          id: 'payroll',
          label: 'Payroll',
          icon: <DollarSign size={24} />,
          view: ViewState.PAYROLL
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: <Settings size={24} />,
          view: ViewState.SETTINGS
        },
        {
          id: 'profile',
          label: 'Profile',
          icon: <User size={24} />,
          view: ViewState.TEAM
        }
      ];
    }

    // Default fallback navigation
    return [
      {
        id: 'home',
        label: 'Home',
        icon: <Home size={24} />,
        view: ViewState.DASHBOARD
      },
      {
        id: 'jobs',
        label: 'Jobs',
        icon: <Briefcase size={24} />,
        view: ViewState.MY_JOBS
      },
      {
        id: 'chat',
        label: 'Chat',
        icon: <MessageCircle size={24} />,
        view: ViewState.AI_ASSISTANT
      },
      {
        id: 'profile',
        label: 'Profile',
        icon: <User size={24} />,
        view: ViewState.SETTINGS
      }
    ];
  };

  const navItems = getNavItems();

  return (
    <>
      <style>
        {`
          @media (min-width: 768px) {
            .mobile-bottom-nav {
              display: none !important;
            }
          }

          .mobile-bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: calc(64px + env(safe-area-inset-bottom, 0px));
            padding-bottom: env(safe-area-inset-bottom, 0px);
            background: rgba(var(--surface-rgb, 30, 30, 35), 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid var(--border-default, rgba(255, 255, 255, 0.1));
            display: flex;
            align-items: flex-start;
            justify-content: space-around;
            z-index: 1000;
          }

          .mobile-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-width: 48px;
            min-height: 48px;
            padding: 8px 12px;
            border: none;
            background: transparent;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            -webkit-tap-highlight-color: transparent;
          }

          .mobile-nav-item:active {
            transform: scale(0.95);
          }

          .mobile-nav-item .nav-icon {
            color: var(--text-secondary, rgba(255, 255, 255, 0.6));
            transition: color 0.2s ease;
          }

          .mobile-nav-item.active .nav-icon {
            color: var(--neural-core, #00D4FF);
          }

          .mobile-nav-item .nav-label {
            font-size: 10px;
            margin-top: 4px;
            color: var(--text-secondary, rgba(255, 255, 255, 0.6));
            font-weight: 500;
            transition: color 0.2s ease;
          }

          .mobile-nav-item.active .nav-label {
            color: var(--neural-core, #00D4FF);
          }

          .nav-badge {
            position: absolute;
            top: 4px;
            right: 8px;
            min-width: 18px;
            height: 18px;
            padding: 0 5px;
            background: #FF3B30;
            border-radius: 9px;
            font-size: 11px;
            font-weight: 600;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          /* Add bottom padding to main content to prevent overlap */
          .mobile-bottom-nav-spacer {
            height: calc(64px + env(safe-area-inset-bottom, 0px));
          }
        `}
      </style>

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const showBadge = item.id === 'chat' && unreadCount > 0;

          return (
            <button
              key={item.id}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onChangeView(item.view)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-icon">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              {showBadge && (
                <span className="nav-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default MobileBottomNav;
