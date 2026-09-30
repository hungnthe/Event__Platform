import { IsIn } from 'class-validator';

export class InitializeWorkflowDto {
  @IsIn(['BASIC_EVENT_WORKFLOW_V1'])
  templateVersion!: 'BASIC_EVENT_WORKFLOW_V1';

  @IsIn(['CURRENT_USER', 'DEPARTMENT_LEADS'])
  assignmentStrategy!: 'CURRENT_USER' | 'DEPARTMENT_LEADS';
}
