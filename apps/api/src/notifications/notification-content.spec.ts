import { sanitizeNotificationText, taskAssignedContent } from './notification-content';

describe('notification content', () => {
  it('uses Vietnamese assignment copy and strips control characters', () => {
    const content = taskAssignedContent({ actorName: 'An\u0000', taskTitle: 'Chuẩn bị\nâm thanh', eventName: 'Đêm nhạc' });
    expect(content.title).toBe('Bạn có công việc mới');
    expect(content.body).toContain('An đã giao cho bạn công việc “Chuẩn bị âm thanh”');
    expect(content.body).toContain('sự kiện “Đêm nhạc”');
  });

  it('enforces the notification text length budget', () => {
    expect(sanitizeNotificationText('  abc   def  ', 7)).toBe('abc def');
  });
});
