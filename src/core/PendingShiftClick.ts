export type PendingShiftClick = {
  targetType: 'page' | 'block';
  targetId: string;
  targetCandidates?: string[];
  searchSection?: 'page' | 'block' | 'recent' | 'create' | null;
  timestamp: number;
  activePaneId: string | null;
  activePaneIndex: number | null;
};
