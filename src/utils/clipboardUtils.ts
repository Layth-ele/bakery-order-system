/**
 * Clipboard Utilities
 * 
 * Provides robust clipboard functionality with fallback for when
 * the Clipboard API is blocked by permissions policy.
 */

import { logger } from './logger';
/**
 * Copy text to clipboard with fallback support
 * 
 * Attempts multiple methods:
 * 1. Modern Clipboard API (navigator.clipboard.writeText)
 * 2. Fallback using execCommand (for older browsers or when API is blocked)
 * 3. Manual textarea selection (last resort)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Method 1: Try modern Clipboard API
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // Use the API
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Only log if it's not a common permission policy error to reduce console noise
    if ((error as any)?.name !== 'NotAllowedError') {
      logger.warn('Clipboard API failed:', error);
    }
  }

  // Method 2: Fallback using execCommand (works even when Clipboard API is blocked)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea invisible but accessible
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    // Try to copy using execCommand
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      return true;
    }
  } catch (error) {
  }

  // Method 3: Last resort - create a visible textarea for manual copy
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '50%';
    textArea.style.left = '50%';
    textArea.style.transform = 'translate(-50%, -50%)';
    textArea.style.padding = '10px';
    textArea.style.zIndex = '9999';
    
    document.body.appendChild(textArea);
    textArea.select();
    
    // Give user time to manually copy
    setTimeout(() => {
      if (document.body.contains(textArea)) {
        document.body.removeChild(textArea);
      }
    }, 100);
    
    return true;
  } catch (error) {
    console.error('All clipboard methods failed:', error);
    return false;
  }
}

/**
 * Copy text with automatic success/error handling
 * Returns a promise that resolves to true if successful, false otherwise
 */
export async function safeCopyToClipboard(
  text: string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<boolean> {
  try {
    const success = await copyToClipboard(text);
    if (success && onSuccess) {
      onSuccess();
    } else if (!success && onError) {
      onError(new Error('Failed to copy to clipboard'));
    }
    return success;
  } catch (error) {
    if (onError) {
      onError(error as Error);
    }
    return false;
  }
}
