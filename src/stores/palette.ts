// ---------------------------------------------------------------------------
// Command Palette Store (Zustand)
// ---------------------------------------------------------------------------

import { create } from 'zustand';

interface PaletteState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const usePaletteStore = create<PaletteState>((set) => ({
  isOpen: false,
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
