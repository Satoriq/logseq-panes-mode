export const EXPECTED_MUTATIONS = {
  dragAndDropItemReordering: 'drag_and_drop_item_reordering',
  movePaneLeftKeyboard: 'move_pane_left_keyboard',
  movePaneRightKeyboard: 'move_pane_right_keyboard',
  newSidebarItemsReordering: 'new_sidebar_items_reordering',
  paneClosing: 'pane_closing',
  paneClosingBatch: 'pane_closing_batch',
  tabDragAndDrop: 'tab_drag_and_drop',
} as const;

export type ExpectedMutation =
  (typeof EXPECTED_MUTATIONS)[keyof typeof EXPECTED_MUTATIONS];
