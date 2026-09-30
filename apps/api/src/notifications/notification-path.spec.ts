import { DomainException } from '../common/domain.exception';
import { assertInternalActionPath, buildTaskActionPath } from './notification-path';

const eventId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';

describe('notification action paths', () => {
  it('builds the exact internal task path', () => {
    expect(buildTaskActionPath(eventId, taskId)).toBe(`/app/events/${eventId}/tasks/${taskId}`);
  });

  it.each(['https://attacker.example/path', '//attacker.example/path', 'javascript:alert(1)', 'data:text/html,x', '/other/path'])(
    'rejects unsafe action path %s',
    (path) => {
      expect(() => assertInternalActionPath(path)).toThrow(DomainException);
    },
  );

  it('permits a normalized first-party application path', () => {
    expect(assertInternalActionPath('/app/events/abc/tasks/def?source=notification')).toBe('/app/events/abc/tasks/def?source=notification');
  });
});
