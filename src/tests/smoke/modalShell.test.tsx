/**
 * The shared modal panel (StyleModalShell): one owner for Escape, icons in
 * any form, and the footer pinned outside the scrolling body.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ShoppingCart } from 'lucide-react';
import { StyleModalShell } from '../../ui/modals/StyleModalShell';
import { ModalFrameContext } from '../../ui/modals/modalFrame';

afterEach(cleanup);

describe('StyleModalShell', () => {
  it('inside BaseModal, Escape is left to BaseModal (one press never closes a whole stack)', () => {
    const onClose = vi.fn();
    render(
      <ModalFrameContext.Provider value={true}>
        <StyleModalShell title="Inner" onClose={onClose}>body</StyleModalShell>
      </ModalFrameContext.Provider>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('on its own, Escape closes it', () => {
    const onClose = vi.fn();
    render(<StyleModalShell title="Standalone" onClose={onClose}>body</StyleModalShell>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts an icon component (Lucide forwardRef) or an element', () => {
    render(<StyleModalShell title="A" icon={ShoppingCart} onClose={() => {}}>x</StyleModalShell>);
    render(<StyleModalShell title="B" icon={<ShoppingCart data-testid="el" />} onClose={() => {}}>x</StyleModalShell>);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByTestId('el')).toBeTruthy();
  });

  it('keeps the footer outside the scrolling body, with a 40px close button', () => {
    render(
      <StyleModalShell title="Form" onClose={() => {}} footer={<button>Save</button>}>
        <p>long body</p>
      </StyleModalShell>,
    );
    const body = screen.getByText('long body').parentElement!;
    expect(body.className).toContain('overflow-y-auto');
    expect(body.contains(screen.getByText('Save'))).toBe(false);
    expect(screen.getByLabelText('Close').className).toContain('h-10 w-10');
  });
});
