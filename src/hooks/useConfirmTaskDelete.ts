import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useTaskStore } from '@/store/taskStore';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { pluralize } from '../utils/format';

export function useConfirmTaskDelete() {
  const { confirmBeforeDelete, deleteSubtasksWithParent } = useSettingsStore();
  const { deleteTask, tasks } = useTaskStore();
  const { confirm } = useConfirmDialog();

  const confirmAndDelete = useCallback(
    async (taskId: string | null | undefined) => {
      if (!taskId) return false;

      // Find the task and count its descendants
      const task = tasks.find(t => t.id === taskId);
      if (!task) return false;

      // Count all descendants recursively
      const countAllDescendants = (parentUid: string): number => {
        const children = tasks.filter(t => t.parentUid === parentUid);
        return children.reduce((acc, child) => acc + 1 + countAllDescendants(child.uid), 0);
      };
      
      const descendantCount = countAllDescendants(task.uid);
      const deleteChildren = deleteSubtasksWithParent === 'delete';

      if (confirmBeforeDelete) {
        // Customize message based on whether task has subtasks
        let message = 'Delete this task? This cannot be undone.';
        if (descendantCount > 0) {
          if (deleteChildren) {
            message = `This task has ${descendantCount} ${pluralize(descendantCount, 'subtask')} that will also be deleted. This cannot be undone.`;
          } else {
            message = `This task has ${descendantCount} ${pluralize(descendantCount, 'subtask')} that will be kept. This cannot be undone.`;
          }
        }
        
        const confirmed = await confirm({
          title: 'Delete task',
          message,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          destructive: true,
        });
        
        if (!confirmed) return false;
      }

      deleteTask(taskId, deleteChildren);
      return true;
    },
    [confirmBeforeDelete, deleteSubtasksWithParent, deleteTask, confirm, tasks]
  );

  return { confirmAndDelete };
}
