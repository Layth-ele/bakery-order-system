/**
 * SearchFiltersPanel Component
 * 
 * Search and filter controls for order lists
 */

import { Search, Calendar, X, ChevronDown } from 'lucide-react';
import { SearchBar } from './ui/SearchBar';

interface SearchFiltersPanelProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  dateFilter: 'all' | 'week' | 'month' | '3months' | '6months' | 'custom';
  setDateFilter: (filter: 'all' | 'week' | 'month' | '3months' | '6months' | 'custom') => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  hideExpandCollapse?: boolean;
  areAllExpanded?: boolean;
  onToggleAll?: () => void;
  orderStatusFilter?: string;
  setOrderStatusFilter?: (status: string) => void;
  enableStatusFilter?: boolean;
}

export function SearchFiltersPanel({
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  hideExpandCollapse = false,
  areAllExpanded = false,
  onToggleAll,
  orderStatusFilter,
  setOrderStatusFilter,
  enableStatusFilter = false,
}: SearchFiltersPanelProps): JSX.Element | null {
  return (
    <div className="border border-[#D4A574]/60 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 bg-gradient-to-br from-white to-[#FFFBF5] shadow-sm">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-gradient-to-br from-[#D4A574] to-[#B89968] rounded-lg shadow-sm">
          <Search className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-[#D4A574] text-sm sm:text-base font-bold">Search & Filter</h3>
          <p className="text-[#999999] text-[10px] sm:text-xs">Find orders quickly and easily</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <SearchBar
          placeholder="Search by customer, order ID, week..."
          value={searchQuery}
          onChange={setSearchQuery}
          variant="luxury"
          showClearButton
        />
      </div>

      {/* Date Range Section */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-[#D4A574]" />
          <h4 className="text-white font-bold">Date Range:</h4>
        </div>
        {/* Mobile: 2 rows x 2 tabs | Desktop: 1 row x 4 tabs */}
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-between mb-3">
          {/* Mobile First Row - All Time & Today */}
          <div className="flex gap-2 sm:contents">
            <button
              onClick={() => setDateFilter('all')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                dateFilter === 'all'
                  ? 'bg-[#D4A574] text-white shadow-md'
                  : 'bg-black/20 text-neutral-400 border border-[#D4A574]/30 hover:bg-black/30'
              }`}
            >
              All Time
            </button>
          </div>
          
          {/* Mobile Second Row - Last 7 Days & Last 30 Days */}
          <div className="flex gap-2 sm:contents">
            <button
              onClick={() => setDateFilter('week')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                dateFilter === 'week'
                  ? 'bg-[#D4A574] text-white shadow-md'
                  : 'bg-black/20 text-neutral-400 border border-[#D4A574]/30 hover:bg-black/30'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                dateFilter === 'month'
                  ? 'bg-[#D4A574] text-white shadow-md'
                  : 'bg-black/20 text-neutral-400 border border-[#D4A574]/30 hover:bg-black/30'
              }`}
            >
              Last 30 Days
            </button>
          </div>

          {/* Custom Range Button */}
          <div className="flex gap-2 sm:contents">
            <button
              onClick={() => setDateFilter('custom')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                dateFilter === 'custom'
                  ? 'bg-[#D4A574] text-white shadow-md'
                  : 'bg-black/20 text-neutral-400 border border-[#D4A574]/30 hover:bg-black/30'
              }`}
            >
              📅 Custom Range
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="mt-3 p-3 bg-black/20 border border-[#D4A574] rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-[#D4A574] p-1 rounded">
                <Calendar className="w-4 h-4" style={{ color: '#FFFFFF', stroke: '#FFFFFF' }} />
              </div>
              <h4 className="text-[#D4A574] font-bold text-sm">Select Date Range:</h4>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Date */}
              <div>
                <label htmlFor="startDate" className="block text-neutral-300 text-xs font-semibold mb-1.5">
                  From:
                </label>
                <div className="relative">
                  <input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-black/20 border border-[#D4A574]/30 rounded-lg focus:outline-none focus:border-[#D4A574] focus:ring-1 focus:ring-[#D4A574] text-neutral-300 font-medium cursor-pointer"
                    style={{
                      colorScheme: 'dark'
                    }}
                  />
                </div>
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-neutral-300 text-xs font-semibold mb-1.5">
                  To:
                </label>
                <div className="relative">
                  <input
                    id="endDate"
                    type="date"
                    value={customEndDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-black/20 border border-[#D4A574]/30 rounded-lg focus:outline-none focus:border-[#D4A574] focus:ring-1 focus:ring-[#D4A574] text-neutral-300 font-medium cursor-pointer"
                    style={{
                      colorScheme: 'dark'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Date Range Info */}
            {customStartDate && customEndDate && (
              <div className="mt-2 p-2 bg-[#4CAF50]/10 border border-[#4CAF50] rounded-lg">
                <div className="flex items-center gap-2 text-[#4CAF50]">
                  <span className="text-sm">✓</span>
                  <span className="font-semibold text-xs text-neutral-300">
                    Showing orders from{' '}
                    <span className="text-[#D4A574] font-bold">
                      {new Date(customStartDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    {' '}to{' '}
                    <span className="text-[#D4A574] font-bold">
                      {new Date(customEndDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Clear Custom Range Button */}
            {(customStartDate || customEndDate) && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F44336] text-white rounded-lg hover:bg-[#D32F2F] transition-colors text-xs font-semibold shadow-md"
                >
                  <X className="w-3 h-3" />
                  Clear Dates
                </button>
              </div>
            )}
          </div>
        )}

        {/* Expand/Collapse Buttons */}
        {!hideExpandCollapse && onToggleAll && (
          <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t-2 border-[#E8C4A2]">
            <button
              onClick={onToggleAll}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-lg font-bold transition-all shadow-md hover:shadow-lg uppercase min-w-[180px] ${
                areAllExpanded
                  ? 'bg-gradient-to-r from-[#2196F3] to-[#1976D2] hover:from-[#1976D2] hover:to-[#1565C0]'
                  : 'bg-gradient-to-r from-[#4CAF50] to-[#45A049] hover:from-[#45A049] hover:to-[#388E3C]'
              }`}
            >
              {areAllExpanded ? (
                <>
                  <ChevronDown className="w-4 h-4 rotate-180" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Expand All
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}