import { Task } from '@/types';

/**
 * extended task type with ancestor information for flat list rendering
 */
export interface FlattenedTask extends Task {
  ancestorIds: string[];
  depth: number;
}

/**
 * flatten a tree of tasks into a single array suitable for dnd-kit SortableContext  
 * each task gets an `ancestorIds` array to track its position in the hierarchy
 */
export function flattenTasks(
  tasks: Task[],
  getChildTasks: (parentUid: string) => Task[],
  getSortedTasks: (tasks: Task[]) => Task[],
  ancestorIds: string[] = []
): FlattenedTask[] {
  const result: FlattenedTask[] = [];

  for (const task of tasks) {
    // add the current task with its ancestor info
    const flattenedTask: FlattenedTask = {
      ...task,
      ancestorIds,
      depth: ancestorIds.length,
    };
    result.push(flattenedTask);

    // if task has children and is not collapsed, recursively add them
    if (!task.isCollapsed) {
      const children = getChildTasks(task.uid);
      if (children.length > 0) {
        const sortedChildren = getSortedTasks(children);
        const childAncestorIds = [...ancestorIds, task.id];
        const flattenedChildren = flattenTasks(
          sortedChildren,
          getChildTasks,
          getSortedTasks,
          childAncestorIds
        );
        result.push(...flattenedChildren);
      }
    }
  }

  return result;
}

/**
 * generate new sort orders and parent assignments after a drag operation
 * returns a map of task IDs to their new { sortOrder, parentUid } values
 */
export function calculateNewPositions(
  flattenedItems: FlattenedTask[],
  activeId: string,
  overId: string
): Map<string, { sortOrder: number; parentUid: string | undefined }> {
  const updates = new Map<string, { sortOrder: number; parentUid: string | undefined }>();
  
  const activeIndex = flattenedItems.findIndex(t => t.id === activeId);
  const overIndex = flattenedItems.findIndex(t => t.id === overId);
  
  if (activeIndex === -1 || overIndex === -1) return updates;
  
  const activeItem = flattenedItems[activeIndex];
  const overItem = flattenedItems[overIndex];
  
  // prevent dropping into own descendants
  if (overItem.ancestorIds.includes(activeId)) {
    return updates;
  }
  
  // determine the new parent for the active item
  // when dropping onto an item, the active item becomes a sibling of the over item
  // (i.e., takes the same parent as the over item)
  let newParentUid: string | undefined;
  
  // check if we're moving into the over item's children
  // if the next item after overItem is a child of overItem, 
  // and we're moving down (activeIndex < overIndex), insert as first child
  const movingDown = activeIndex < overIndex;
  let insertAsFirstChild = false;
  
  if (movingDown && overIndex + 1 < flattenedItems.length) {
    const nextItem = flattenedItems[overIndex + 1];
    if (nextItem.ancestorIds.includes(overItem.id)) {
      // the next item is a child of overItem, so insert as first child of overItem
      insertAsFirstChild = true;
      newParentUid = overItem.uid;
    }
  }
  
  if (!insertAsFirstChild) {
    // become a sibling of overItem (same parent)
    newParentUid = overItem.parentUid;
  }
  
  // get all siblings at the target level (excluding the active item)
  const targetParentUid = newParentUid;
  const siblings = flattenedItems.filter(
    t => t.parentUid === targetParentUid && t.id !== activeId
  );
  
  // find the position of overItem among siblings
  const overSiblingIndex = siblings.findIndex(t => t.id === overId);
  
  // create new sorted order
  const newOrder = [...siblings];
  
  if (insertAsFirstChild) {
    // insert at the beginning of overItem's children
    const childrenOfOver = flattenedItems.filter(
      t => t.parentUid === overItem.uid && t.id !== activeId
    );
    // active item gets sortOrder before the first child
    const minChildOrder = childrenOfOver.length > 0
      ? Math.min(...childrenOfOver.map(t => t.sortOrder))
      : activeItem.sortOrder;
    
    updates.set(activeId, {
      sortOrder: minChildOrder - 1,
      parentUid: overItem.uid,
    });
  } else {
    // insert at the appropriate position among siblings
    let insertIndex: number;
    
    if (overSiblingIndex === -1) {
      // overItem is not a direct sibling, insert at the end
      insertIndex = newOrder.length;
    } else if (movingDown) {
      insertIndex = overSiblingIndex + 1;
    } else {
      insertIndex = overSiblingIndex;
    }
    
    // assign new sort orders
    newOrder.splice(insertIndex, 0, activeItem);
    
    // assign sort orders with gaps
    newOrder.forEach((task, index) => {
      const newSortOrder = (index + 1) * 100;
      updates.set(task.id, {
        sortOrder: newSortOrder,
        parentUid: targetParentUid,
      });
    });
  }
  
  return updates;
}
