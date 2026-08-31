/**
 * KeyboardShortcutsModal Component
 * ✅ FEB 21, 2026: Help modal showing all available keyboard shortcuts
 * 
 * Features:
 * - Displays all shortcuts grouped by category
 * - Platform-aware display (Mac vs Windows)
 * - Searchable shortcut list
 * - Accessible and responsive
 */

import { StyleModalShell } from '../../ui/modals/StyleModalShell';
import { CloseFooter } from '../../ui/modals/ModalFooterButtons'; // ✅ FEB 21, 2026
import { Keyboard, Command, Search } from 'lucide-react';
import { SearchBar } from '../../components/ui/SearchBar';
import { KeyboardShortcut, formatShortcut, groupShortcutsByCategory } from '../../hooks/useKeyboardShortcuts';
import { useState, useMemo } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

const categoryNames: Record<string, string> = {
  general: 'General',
  navigation: 'Navigation',
  actions: 'Actions',
  modals: 'Modals',
  filters: 'Filters & Search',
};

const categoryIcons: Record<string, string> = {
  general: '⚡',
  navigation: '🧭',
  actions: '⚙️',
  modals: '📋',
  filters: '🔍',
};

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  shortcuts,
}: KeyboardShortcutsModalProps): JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter shortcuts by search query
  const filteredShortcuts = useMemo(() => {
    if (!searchQuery.trim()) return shortcuts;

    const query = searchQuery.toLowerCase();
    return shortcuts.filter(
      (shortcut) =>
        shortcut.description.toLowerCase().includes(query) ||
        shortcut.key.toLowerCase().includes(query) ||
        formatShortcut(shortcut).toLowerCase().includes(query)
    );
  }, [shortcuts, searchQuery]);

  // Group filtered shortcuts by category
  const groupedShortcuts = useMemo(() => {
    return groupShortcutsByCategory(filteredShortcuts);
  }, [filteredShortcuts]);

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <StyleModalShell
      width="4xl"
      skinType="info"
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      subtitle="Speed up your workflow with these shortcuts"
      icon={<Keyboard className="w-6 h-6" />}
    >
      <div className="space-y-6">
        {/* Search Bar */}
        <SearchBar
          placeholder="Search shortcuts..."
          value={searchQuery}
          onChange={setSearchQuery}
          autoFocus
        />

        {/* Platform Info */}
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-2xl">💡</div>
          <div className="text-sm text-blue-900">
            <strong>Tip:</strong> Shortcuts are disabled while typing in text fields.
            {isMac ? ' ⌘ = Command key' : ' Win = Windows key'}
          </div>
        </div>

        {/* Shortcuts by Category */}
        <div className="space-y-6">
          {(Object.entries(groupedShortcuts) as [string, any[]][]).map(([category, categoryShortcuts]) => {
            if (categoryShortcuts.length === 0) return null;

            return (
              <div key={category} className="space-y-3">
                {/* Category Header */}
                <div className="flex items-center gap-2 pb-2 border-b-2 border-[#D4A574]/30">
                  <span className="text-2xl">{categoryIcons[category] || '📌'}</span>
                  <h3 className="text-lg font-bold text-[#333333]">
                    {categoryNames[category] || category}
                  </h3>
                  <span className="ml-auto text-sm text-neutral-500">
                    {categoryShortcuts.length} shortcut{categoryShortcuts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Shortcuts List */}
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, idx) => (
                    <div
                      key={`${category}-${idx}`}
                      className="flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                      {/* Description */}
                      <div className="flex-1 text-neutral-700">
                        {shortcut.description}
                      </div>

                      {/* Shortcut Keys */}
                      <div className="flex items-center gap-1 ml-4">
                        <kbd className="px-3 py-1.5 bg-white border-2 border-neutral-300 rounded-md text-sm font-mono font-semibold text-neutral-800 shadow-sm min-w-[3rem] text-center">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filteredShortcuts.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500 text-lg font-medium mb-2">
              No shortcuts found
            </p>
            <p className="text-neutral-400 text-sm">
              Try adjusting your search query
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="pt-4 border-t border-neutral-200">
          <div className="flex items-start gap-3 text-sm text-neutral-600">
            <div className="text-xl">ℹ️</div>
            <div>
              <p className="mb-2">
                <strong>Pro Tip:</strong> Press <kbd className="px-2 py-1 bg-neutral-100 border border-neutral-300 rounded text-xs font-mono">?</kbd> anytime to open this help menu.
              </p>
              <p className="text-neutral-500 mb-2">
                Many buttons throughout the app have keyboard shortcuts. Hover over buttons to see their keyboard hints.
              </p>
              <p className="text-neutral-500">
                Shortcuts work throughout the application and adapt to your current context.
              </p>
            </div>
          </div>
        </div>
      </div>
      <CloseFooter onClose={onClose} />
    </StyleModalShell>
  );
}