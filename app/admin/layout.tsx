'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Users, 
  LayoutGrid, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Shield
} from 'lucide-react';

const menuItems = [
  {
    id: 'users',
    label: 'Utenti',
    icon: Users,
    href: '/admin/users'
  },
  {
    id: 'roles',
    label: 'Ruoli',
    icon: Shield,
    href: '/admin/roles'
  },
  {
    id: 'tavoli',
    label: 'Tavoli',
    icon: LayoutGrid,
    href: '/admin/tavoli'
  },
  {
    id: 'settings',
    label: 'Impostazioni',
    icon: Settings,
    href: '/admin/settings'
  }
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-black">
      {/* Sidebar */}
      <div 
        className={`${
          isCollapsed ? 'w-16' : 'w-64'
        } bg-gray-900 border-r border-gray-800 transition-all duration-300`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <h2 
              className={`text-xl font-bold text-white transition-opacity duration-300 ${
                isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
              }`}
            >
              Admin Panel
            </h2>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center ${
                  isCollapsed ? 'justify-center' : 'gap-3'
                } px-3 py-2 rounded-lg transition-colors ${
                  pathname === item.href
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}