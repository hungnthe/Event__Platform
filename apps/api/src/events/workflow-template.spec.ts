import { TaskPriority } from '@prisma/client';
import { starterTaskDueAt } from './workflow.service';
import { basicEventWorkflowV1, canonicalWorkflowStages } from './workflow-template';

describe('basic event workflow template', () => {
  it('defines four canonical stages and exactly 24 unique starter tasks', () => {
    expect(canonicalWorkflowStages.map((stage) => stage.code)).toEqual(['DESIGN', 'PREPARATION', 'EXECUTION', 'FEEDBACK']);
    expect(basicEventWorkflowV1).toHaveLength(24);
    expect(new Set(basicEventWorkflowV1.map((task) => task.templateKey)).size).toBe(24);
    expect(basicEventWorkflowV1.filter((task) => task.stageCode === 'DESIGN')).toHaveLength(5);
    expect(basicEventWorkflowV1.filter((task) => task.stageCode === 'PREPARATION')).toHaveLength(7);
    expect(basicEventWorkflowV1.filter((task) => task.stageCode === 'EXECUTION')).toHaveLength(6);
    expect(basicEventWorkflowV1.filter((task) => task.stageCode === 'FEEDBACK')).toHaveLength(6);
    expect(basicEventWorkflowV1.every((task) => task.origin === 'WORKFLOW_TEMPLATE')).toBe(true);
  });

  it('clamps overdue pre-event suggestions to initialization time for an upcoming event', () => {
    const initializedAt = new Date('2026-10-01T08:00:00.000Z');
    const event = {
      startsAt: new Date('2026-10-05T08:00:00.000Z'),
      endsAt: new Date('2026-10-05T12:00:00.000Z'),
    };
    const task = {
      dueOffset: { anchor: 'START' as const, milliseconds: -45 * 86_400_000 },
      stageCode: 'DESIGN' as const,
      templateKey: 'test',
      title: 'Test',
      description: 'Test',
      priority: TaskPriority.HIGH,
      origin: 'WORKFLOW_TEMPLATE' as const,
    };

    expect(starterTaskDueAt(event, initializedAt, task)).toEqual(initializedAt);
  });

  it('preserves historical due dates when initializing a past event', () => {
    const initializedAt = new Date('2026-10-01T08:00:00.000Z');
    const event = {
      startsAt: new Date('2026-09-01T08:00:00.000Z'),
      endsAt: new Date('2026-09-01T12:00:00.000Z'),
    };
    const task = {
      dueOffset: { anchor: 'END' as const, milliseconds: 24 * 3_600_000 },
      stageCode: 'FEEDBACK' as const,
      templateKey: 'test',
      title: 'Test',
      description: 'Test',
      priority: TaskPriority.MEDIUM,
      origin: 'WORKFLOW_TEMPLATE' as const,
    };

    expect(starterTaskDueAt(event, initializedAt, task)).toEqual(new Date('2026-09-02T12:00:00.000Z'));
  });
});
