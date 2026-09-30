import { TaskPriority, type TaskOrigin } from '@prisma/client';

export const BASIC_EVENT_WORKFLOW_V1 = 'BASIC_EVENT_WORKFLOW_V1' as const;

export const canonicalWorkflowStages = [
  { code: 'DESIGN', name: 'Thiết kế', label: 'Thiết kế', summary: 'Mục tiêu · concept · agenda', iconKey: 'sparkles', order: 1 },
  { code: 'PREPARATION', name: 'Chuẩn bị', label: 'Chuẩn bị', summary: 'Công việc · đội ngũ · tài liệu · ngân sách', iconKey: 'clipboard', order: 2 },
  { code: 'EXECUTION', name: 'Thực thi', label: 'Thực thi', summary: 'Trạng thái trực tiếp · sự cố · checklist', iconKey: 'play', order: 3 },
  { code: 'FEEDBACK', name: 'Đánh giá', label: 'Đánh giá', summary: 'Phản hồi · báo cáo · bài học kinh nghiệm', iconKey: 'chart', order: 4 },
] as const;

export type CanonicalWorkflowStageCode = (typeof canonicalWorkflowStages)[number]['code'];
type DueOffset = { anchor: 'START' | 'END'; milliseconds: number };

export interface StarterWorkflowTask {
  stageCode: CanonicalWorkflowStageCode;
  templateKey: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueOffset: DueOffset;
  origin: TaskOrigin;
}

const days = (value: number): number => value * 86_400_000;
const hours = (value: number): number => value * 3_600_000;
const start = (offset: number): DueOffset => ({ anchor: 'START', milliseconds: offset });
const end = (offset: number): DueOffset => ({ anchor: 'END', milliseconds: offset });

export const basicEventWorkflowV1: readonly StarterWorkflowTask[] = [
  { stageCode: 'DESIGN', templateKey: 'design.define-goals', title: 'Xác định mục tiêu và KPI sự kiện', description: 'Xác định mục tiêu chính, kết quả mong đợi và các chỉ số dùng để đánh giá sự kiện.', priority: TaskPriority.HIGH, dueOffset: start(-days(45)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'DESIGN', templateKey: 'design.define-audience', title: 'Xác định đối tượng tham gia', description: 'Mô tả nhóm người tham gia mục tiêu, quy mô dự kiến và nhu cầu chính của họ.', priority: TaskPriority.HIGH, dueOffset: start(-days(42)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'DESIGN', templateKey: 'design.create-concept', title: 'Xây dựng concept và thông điệp chính', description: 'Xác định concept, chủ đề, tone, màu sắc và thông điệp xuyên suốt sự kiện.', priority: TaskPriority.HIGH, dueOffset: start(-days(38)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'DESIGN', templateKey: 'design.draft-agenda', title: 'Phác thảo agenda chương trình', description: 'Tạo agenda sơ bộ gồm các nội dung, hoạt động và thời lượng chính.', priority: TaskPriority.MEDIUM, dueOffset: start(-days(32)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'DESIGN', templateKey: 'design.define-scope', title: 'Xác định phạm vi và quy mô sự kiện', description: 'Xác định số lượng người tham gia, hình thức, địa điểm dự kiến và giới hạn phạm vi.', priority: TaskPriority.MEDIUM, dueOffset: start(-days(30)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.setup-team', title: 'Thành lập ban tổ chức và phân vai', description: 'Xác định các ban, người phụ trách và trách nhiệm chính của từng thành viên.', priority: TaskPriority.HIGH, dueOffset: start(-days(28)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.master-timeline', title: 'Lập timeline tổng thể', description: 'Xây dựng các mốc chuẩn bị, deadline chính và thời điểm kiểm tra tiến độ.', priority: TaskPriority.HIGH, dueOffset: start(-days(26)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.create-budget', title: 'Lập ngân sách dự kiến', description: 'Tổng hợp các khoản chi dự kiến và giới hạn ngân sách cho sự kiện.', priority: TaskPriority.HIGH, dueOffset: start(-days(21)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.confirm-venue', title: 'Xác nhận địa điểm tổ chức', description: 'Kiểm tra sức chứa, cơ sở vật chất, thời gian sử dụng và xác nhận địa điểm.', priority: TaskPriority.HIGH, dueOffset: start(-days(21)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.communication-plan', title: 'Lập kế hoạch truyền thông', description: 'Xác định các nội dung, kênh truyền thông, lịch đăng bài và người phụ trách.', priority: TaskPriority.MEDIUM, dueOffset: start(-days(18)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.vendors-documents', title: 'Chuẩn bị nhà cung cấp và tài liệu', description: 'Tổng hợp nhà cung cấp, hợp đồng, kịch bản, thiết kế và các tài liệu cần thiết.', priority: TaskPriority.MEDIUM, dueOffset: start(-days(10)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'PREPARATION', templateKey: 'preparation.readiness-check', title: 'Kiểm tra mức độ sẵn sàng', description: 'Kiểm tra các công việc quan trọng trước ngày diễn ra và xác định nội dung còn thiếu.', priority: TaskPriority.URGENT, dueOffset: start(-days(2)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'EXECUTION', templateKey: 'execution.team-briefing', title: 'Brief đội ngũ ngày diễn ra', description: 'Phổ biến timeline, trách nhiệm, kênh liên lạc và quy trình xử lý tình huống.', priority: TaskPriority.HIGH, dueOffset: start(-days(1)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'EXECUTION', templateKey: 'execution.venue-setup', title: 'Setup địa điểm', description: 'Kiểm tra sân khấu, âm thanh, ánh sáng, backdrop, bàn ghế và khu vực vận hành.', priority: TaskPriority.URGENT, dueOffset: start(-hours(4)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'EXECUTION', templateKey: 'execution.checkin-readiness', title: 'Kiểm tra khu vực check-in', description: 'Đảm bảo danh sách khách, thiết bị, nhân sự và quy trình check-in đã sẵn sàng.', priority: TaskPriority.URGENT, dueOffset: start(-hours(1)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'EXECUTION', templateKey: 'execution.run-of-show', title: 'Theo dõi run-of-show', description: 'Theo dõi agenda thực tế và cập nhật tình trạng từng nội dung trong chương trình.', priority: TaskPriority.HIGH, dueOffset: start(0), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'EXECUTION', templateKey: 'execution.incident-tracking', title: 'Ghi nhận và xử lý sự cố', description: 'Ghi nhận vấn đề phát sinh, người xử lý, mức độ ảnh hưởng và kết quả xử lý.', priority: TaskPriority.HIGH, dueOffset: start(0), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'EXECUTION', templateKey: 'execution.final-status-check', title: 'Chốt trạng thái công việc ngày diễn ra', description: 'Kiểm tra toàn bộ công việc vận hành trước khi kết thúc sự kiện.', priority: TaskPriority.HIGH, dueOffset: end(0), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'FEEDBACK', templateKey: 'feedback.collect-feedback', title: 'Thu thập phản hồi', description: 'Thu thập phản hồi từ người tham gia, khách mời, đối tác và thành viên ban tổ chức.', priority: TaskPriority.MEDIUM, dueOffset: end(days(1)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'FEEDBACK', templateKey: 'feedback.reconcile-costs', title: 'Đối soát chi phí thực tế', description: 'Tổng hợp chi phí thực tế, hóa đơn và các khoản vượt hoặc tiết kiệm ngân sách.', priority: TaskPriority.HIGH, dueOffset: end(days(2)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'FEEDBACK', templateKey: 'feedback.summarize-kpis', title: 'Tổng hợp kết quả và KPI', description: 'So sánh kết quả thực tế với mục tiêu và KPI đã đặt ra.', priority: TaskPriority.HIGH, dueOffset: end(days(3)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'FEEDBACK', templateKey: 'feedback.retrospective', title: 'Họp retrospective', description: 'Tổ chức buổi họp nội bộ để xác định điều làm tốt, điều cần cải thiện và nguyên nhân.', priority: TaskPriority.MEDIUM, dueOffset: end(days(5)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'FEEDBACK', templateKey: 'feedback.post-event-report', title: 'Lập báo cáo sau sự kiện', description: 'Tạo báo cáo tổng kết gồm kết quả, chi phí, vấn đề phát sinh và đề xuất cải thiện.', priority: TaskPriority.HIGH, dueOffset: end(days(5)), origin: 'WORKFLOW_TEMPLATE' },
  { stageCode: 'FEEDBACK', templateKey: 'feedback.archive-lessons', title: 'Lưu bài học và tài liệu dùng lại', description: 'Lưu các checklist, template, tài liệu và bài học có thể tái sử dụng cho sự kiện sau.', priority: TaskPriority.MEDIUM, dueOffset: end(days(7)), origin: 'WORKFLOW_TEMPLATE' },
];
