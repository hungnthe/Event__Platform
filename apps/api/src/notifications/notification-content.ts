export function sanitizeNotificationText(value: string, maximumLength: number): string {
  return removeControlCharacters(value).replace(/\s+/g, ' ').trim().slice(0, maximumLength);
}

export function taskAssignedContent(input: { actorName: string; taskTitle: string; eventName: string }): { title: string; body: string } {
  const actorName = sanitizeNotificationText(input.actorName, 120) || 'Một thành viên';
  const taskTitle = sanitizeNotificationText(input.taskTitle, 180) || 'không có tiêu đề';
  const eventName = sanitizeNotificationText(input.eventName, 180) || 'sự kiện';
  return {
    title: 'Bạn có công việc mới',
    body: `${actorName} đã giao cho bạn công việc “${taskTitle}” trong sự kiện “${eventName}”.`,
  };
}

export function sanitizeOutboxError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Không thể phát thông báo thời gian thực.';
  return removeControlCharacters(message)
    .replace(/(password|token|secret|authorization|cookie)(\s*[=:]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) || 'Không thể phát thông báo thời gian thực.';
}

function removeControlCharacters(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 31) || code === 127 ? ' ' : character;
  }).join('');
}
