/**
 * Tells a modal panel (StyleModalShell) that it is rendered inside BaseModal,
 * which already owns the backdrop, Escape key, focus trap and focus restore.
 * The panel then skips its own copies — otherwise one Escape press closed
 * every modal in a stack.
 */
import { createContext, useContext } from 'react';

export const ModalFrameContext = createContext(false);
export const useInModalFrame = (): boolean => useContext(ModalFrameContext);
