import type { BuildStatus, OpportunityStatus, PortfolioStatus, ResourceType, SessionType, TechnicalLevel } from '../types';
import type { WeekStatus } from './progress';

export const BUILD_STATUS_LABELS: Record<BuildStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  building: 'Building',
  blocked: 'Blocked',
  completed: 'Completed',
  published: 'Published',
};
export const BUILD_STATUSES = Object.keys(BUILD_STATUS_LABELS) as BuildStatus[];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  validating: 'Validating',
  promising: 'Promising',
  archived: 'Archived',
};
export const OPPORTUNITY_STATUSES = Object.keys(OPPORTUNITY_STATUS_LABELS) as OpportunityStatus[];

export const PORTFOLIO_STATUS_LABELS: Record<PortfolioStatus, string> = {
  'not-started': 'Not started',
  building: 'Building',
  complete: 'Complete',
  published: 'Published',
};

export const WEEK_STATUS_LABELS: Record<WeekStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  complete: 'Complete',
  blocked: 'Blocked',
};

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  docs: 'Official docs',
  tutorial: 'Tutorial',
  article: 'Article',
  video: 'Video',
  book: 'Book',
  practice: 'Practice tool',
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  learn: 'Learning',
  practice: 'Practice',
  build: 'Building',
  mastery: 'Mastery test',
  research: 'Research',
  review: 'Review',
};

export const TECH_LEVEL_LABELS: Record<TechnicalLevel, string> = {
  new: 'New to code',
  'some-code': 'Some code (HTML/CSS, a little JS)',
  'shipped-small': 'Shipped small projects',
  comfortable: 'Comfortable building apps',
};
