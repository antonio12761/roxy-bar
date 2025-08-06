import { LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ClientStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
}

export default function ClientStatsCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle 
}: ClientStatsCardProps) {
  const { currentTheme, themeMode } = useTheme();
  const resolvedMode = themeMode === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : themeMode;
  const colors = currentTheme.colors[resolvedMode as 'light' | 'dark'];

  return (
    <div 
      className="rounded-lg p-6 transition-all duration-200 hover:scale-105"
      style={{ 
        backgroundColor: colors.bg.card,
        borderColor: colors.border.primary,
        borderWidth: '1px',
        borderStyle: 'solid'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <Icon className="h-8 w-8" style={{ color }} />
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: colors.text.primary }}>
            {value}
          </div>
          {subtitle && (
            <div className="text-sm" style={{ color: colors.text.secondary }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm font-medium" style={{ color: colors.text.secondary }}>
        {title}
      </div>
    </div>
  );
}