/**
 * OrderActionButtons Component
 * 
 * Renders action button sections for orders
 */

import { Order } from '../../types';
import { ActionButtonSection } from './UnifiedOrderList';
import { getButtonStyles } from '../../utils/orderUi';

interface OrderActionButtonsProps {
  order: Order;
  actionButtonSections: ActionButtonSection[];
}

export function OrderActionButtons({ order, actionButtonSections }: OrderActionButtonsProps): JSX.Element | null {
  return (
    <div className="space-y-2 pt-2 sm:pt-3 border-t border-[#E8C4A2]">
      {actionButtonSections.slice().reverse().map((section, sectionIndex) => {
        // Filter buttons based on show condition
        const visibleButtons = section.buttons.filter(btn => 
          !btn.show || btn.show(order)
        );

        if (visibleButtons.length === 0) return null;

        return (
          <div key={sectionIndex} className={sectionIndex > 0 ? 'pt-2 border-t border-[#E8C4A2]' : ''}>
            {section.title && (
              <div className="text-[#999999] text-xs font-bold mb-2 uppercase">{section.title}</div>
            )}
            <div className={`flex items-center gap-2 sm:gap-3 flex-wrap ${section.layout === 'center' ? 'justify-center' : 'justify-around'}`}>
              {visibleButtons.map((button, btnIndex) => {
                const Icon = typeof button.icon === 'function' && (button.icon as any).length > 0 ? (button.icon as any)(order) : button.icon;
                const label = typeof button.label === 'function' ? button.label(order) : button.label;
                const variant = typeof button.variant === 'function' ? button.variant(order) : button.variant;
                const isDisabled = button.disabled ? (typeof button.disabled === 'function' ? button.disabled(order) : button.disabled) : false;
                const tooltip = button.tooltip ? (typeof button.tooltip === 'function' ? button.tooltip(order) : button.tooltip) : '';
                
                return (
                  <button
                    key={btnIndex}
                    onClick={() => {
                      if (!isDisabled) {
                        button.onClick(order);
                      }
                    }}
                    disabled={isDisabled}
                    title={isDisabled ? tooltip : ''}
                    className={`${getButtonStyles(variant)} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="text-xs">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}