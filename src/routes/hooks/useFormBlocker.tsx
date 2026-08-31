/**
 * useFormBlocker.tsx
 * Hook for blocking navigation on forms with unsaved changes
 * 
 * Features:
 * - Automatically tracks form dirty state
 * - Shows confirmation modal
 * - Prevents accidental data loss
 */

import { useBlocker } from './useBlocker';
import { NavigationBlocker } from '../components/NavigationBlocker';

interface UseFormBlockerOptions {
  /**
   * Whether the form has unsaved changes
   */
  isDirty: boolean;
  
  /**
   * Custom confirmation message
   */
  message?: string;
  
  /**
   * Callback when navigation is confirmed (optional cleanup)
   */
  onNavigate?: () => void;
}

/**
 * Hook for blocking navigation when form has unsaved changes
 * 
 * @example
 * const { FormBlocker } = useFormBlocker({
 *   isDirty: form.formState.isDirty,
 *   message: 'You have unsaved order changes.',
 * });
 * 
 * return (
 *   <>
 *     <form>...</form>
 *     <FormBlocker />
 *   </>
 * );
 */
export function useFormBlocker(options: UseFormBlockerOptions) {
  const { isDirty, message, onNavigate } = options;
  
  const { shouldBlock, confirmNavigation, cancelNavigation } = useBlocker({
    when: isDirty,
    message: message || 'You have unsaved changes. Are you sure you want to leave?',
  });
  
  const handleConfirm = () => {
    onNavigate?.();
    confirmNavigation();
  };
  
  // Return a component that renders the blocker
  const FormBlocker = () => (
    <NavigationBlocker
      isBlocked={shouldBlock}
      onConfirm={handleConfirm}
      onCancel={cancelNavigation}
      message={message}
    />
  );
  
  return {
    FormBlocker,
    shouldBlock,
    confirmNavigation: handleConfirm,
    cancelNavigation,
  };
}

/**
 * Simple blocker for React Hook Form
 * 
 * @example
 * const { FormBlocker } = useReactHookFormBlocker(form);
 */
export function useReactHookFormBlocker(form: any, message?: string) {
  return useFormBlocker({
    isDirty: form?.formState?.isDirty || false,
    message: message || 'You have unsaved form changes. Are you sure you want to leave?',
  });
}
