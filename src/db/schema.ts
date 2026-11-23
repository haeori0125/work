import {
  integer, pgTable, primaryKey, serial, text, timestamp, unique,
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

export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  clockIn: ts('clock_in').notNull(),
  clockOut: ts('clock_out'),
}, (t) => [unique().on(t.userId, t.date)]);

export const attendanceEdits = pgTable('attendance_edits', {
  id: serial('id').primaryKey(),
  attendanceId: integer('attendance_id').notNull().references(() => attendance.id, { onDelete: 'cascade' }),
  editedBy: integer('edited_by').notNull().references(() => users.id),
  at: ts('at').notNull(),
  oldClockIn: ts('old_clock_in').notNull(),
  oldClockOut: ts('old_clock_out'),
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

export const personalMemos = pgTable('personal_memos', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  updatedAt: ts('updated_at').notNull(),
});
