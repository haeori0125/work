import {
  boolean, index, integer, pgTable, primaryKey, serial, text, timestamp, unique,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['member', 'admin'] }).notNull().default('member'),
  status: text('status', { enum: ['pending', 'active', 'disabled'] }).notNull().default('pending'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const loginEvents = pgTable('login_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  at: ts('at').notNull(),
});

export const loginFailures = pgTable('login_failures', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  at: ts('at').notNull(),
});



export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  kind: text('kind', { enum: ['dated', 'weekly'] }).notNull(),
  repeat: text('repeat', { enum: ['none', 'daily', 'weekdays', 'weekly_days', 'weekly'] }).notNull(),
  weekdays: integer('weekdays').array().notNull().default([]),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  /** 주간 업무의 마감 요일 (0=월 … 6=일), 없으면 null */
  dueWeekday: integer('due_weekday'),
  /** 한 번만 하는 주간 업무의 정확한 마감일 (YYYY-MM-DD) */
  dueDate: text('due_date'),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: ts('created_at').notNull().defaultNow(),
  deletedAt: ts('deleted_at'),
});

export const taskAssignees = pgTable('task_assignees', {
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.taskId, t.userId] })]);

const statusEnum = ['todo', 'doing', 'done'] as const;

export const taskStatus = pgTable('task_status', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  occurrenceKey: text('occurrence_key').notNull(),
  status: text('status', { enum: statusEnum }).notNull(),
  updatedBy: integer('updated_by').notNull().references(() => users.id),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [unique().on(t.taskId, t.occurrenceKey)]);

export const taskParts = pgTable('task_parts', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  assigneeId: integer('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  sort: integer('sort').notNull().default(0),
});

export const partStatus = pgTable('part_status', {
  id: serial('id').primaryKey(),
  partId: integer('part_id').notNull().references(() => taskParts.id, { onDelete: 'cascade' }),
  occurrenceKey: text('occurrence_key').notNull(),
  status: text('status', { enum: statusEnum }).notNull(),
  updatedBy: integer('updated_by').notNull().references(() => users.id),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [unique().on(t.partId, t.occurrenceKey)]);

export const taskStatusHistory = pgTable('task_status_history', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  occurrenceKey: text('occurrence_key').notNull(),
  fromStatus: text('from_status', { enum: statusEnum }).notNull(),
  toStatus: text('to_status', { enum: statusEnum }).notNull(),
  changedBy: integer('changed_by').notNull().references(() => users.id),
  at: ts('at').notNull(),
});

export const taskComments = pgTable('task_comments', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  occurrenceKey: text('occurrence_key').notNull(),
  authorId: integer('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});

export const boardPosts = pgTable('board_posts', {
  id: serial('id').primaryKey(),
  date: text('date').notNull(),
  authorId: integer('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
});


export const workSegments = pgTable('work_segments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  clockIn: ts('clock_in').notNull(),
  clockOut: ts('clock_out'),
}, (t) => [index('work_segments_user_date').on(t.userId, t.date)]);

export const segmentEdits = pgTable('segment_edits', {
  id: serial('id').primaryKey(),
  segmentId: integer('segment_id').notNull().references(() => workSegments.id, { onDelete: 'cascade' }),
  editedBy: integer('edited_by').notNull().references(() => users.id),
  at: ts('at').notNull(),
  oldClockIn: ts('old_clock_in').notNull(),
  oldClockOut: ts('old_clock_out'),
});

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  pinned: boolean('pinned').notNull().default(false),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
}, (t) => [index('notes_user').on(t.userId)]);

export const userPrefs = pgTable('user_prefs', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  themeH: integer('theme_h').notNull().default(232),
  themeS: integer('theme_s').notNull().default(55),
  themeL: integer('theme_l').notNull().default(76),
  themeHex: text('theme_hex'),
  weekStart: text('week_start', { enum: ['mon', 'sun'] }).notNull().default('mon'),
  doingHex: text('doing_hex'),
  doneHex: text('done_hex'),
  avatar: text('avatar'),
  /** 위클리 담당 필터 (이름 목록 JSON), 없으면 전체 */
  weekFilter: text('week_filter'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

/** 멤버가 올린 업무 추가 요청. 관리자가 승인하면 업무가 만들어지고 taskId가 채워진다 */
export const taskRequests = pgTable('task_requests', {
  id: serial('id').primaryKey(),
  requesterId: integer('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  /** 원하는 날짜 (YYYY-MM-DD), 없으면 null */
  wantedDate: text('wanted_date'),
  /** 요청한 업무 설정 전체(TaskInput JSON). 관리자 승인 폼에 그대로 채워진다 */
  spec: text('spec'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  createdAt: ts('created_at').notNull(),
  decidedBy: integer('decided_by').references(() => users.id, { onDelete: 'set null' }),
  decidedAt: ts('decided_at'),
  taskId: integer('task_id').references(() => tasks.id, { onDelete: 'set null' }),
}, (t) => [index('task_requests_status').on(t.status), index('task_requests_requester').on(t.requesterId)]);
