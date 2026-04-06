export type ProjectData = {
  name: string;
  panesOrder: string[];
  paneDimensions: Record<string, { width: number; height?: number }>;
  paneFitContentHeight: Record<string, boolean>;
  paneCollapseOrientation: Record<string, 'vertical' | 'horizontal'>;
  createdAt: number;
  updatedAt: number;
};

export type ProjectListItem = {
  id: string;
  data: ProjectData;
};
