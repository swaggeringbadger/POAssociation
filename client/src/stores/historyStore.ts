import { create } from 'zustand';
import type { AdditionalInfoConfig } from '@shared/formTypes';

export interface HistoryCommand {
  type: string;
  description: string;
  previousState: AdditionalInfoConfig;
  nextState: AdditionalInfoConfig;
}

interface HistoryState {
  history: HistoryCommand[];
  currentIndex: number;
  maxHistory: number;

  // Actions
  executeCommand: (command: HistoryCommand) => void;
  undo: () => AdditionalInfoConfig | null;
  redo: () => AdditionalInfoConfig | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  currentIndex: -1,
  maxHistory: 50,

  executeCommand: (command: HistoryCommand) => set((state) => {
    // Remove any redo history when executing a new command
    const history = state.history.slice(0, state.currentIndex + 1);

    // Add new command
    history.push(command);

    // Limit history size
    const trimmedHistory = history.slice(-state.maxHistory);

    return {
      history: trimmedHistory,
      currentIndex: trimmedHistory.length - 1,
    };
  }),

  undo: () => {
    const state = get();
    if (!state.canUndo()) return null;

    const command = state.history[state.currentIndex];
    set({ currentIndex: state.currentIndex - 1 });

    return command.previousState;
  },

  redo: () => {
    const state = get();
    if (!state.canRedo()) return null;

    const command = state.history[state.currentIndex + 1];
    set({ currentIndex: state.currentIndex + 1 });

    return command.nextState;
  },

  canUndo: () => {
    const state = get();
    return state.currentIndex >= 0;
  },

  canRedo: () => {
    const state = get();
    return state.currentIndex < state.history.length - 1;
  },

  clear: () => set({
    history: [],
    currentIndex: -1,
  }),
}));
