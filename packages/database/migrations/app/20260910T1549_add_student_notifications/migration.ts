#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8be37be02911c44d313b1db45ccde66c76824713115e4568d70a0e0e0c8a5874/contract';
import endContract from '../../snapshots/8be37be02911c44d313b1db45ccde66c76824713115e4568d70a0e0e0c8a5874/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/be4ae4daee453d340e28887e5ea22cd5d57be0d7e7c0d15ccac71a34b44788e7/contract';
import startContract from '../../snapshots/be4ae4daee453d340e28887e5ea22cd5d57be0d7e7c0d15ccac71a34b44788e7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'studentNotification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('deadlineId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('examId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isRead', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('postId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'studentNotification',
        index: 'studentNotification_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'studentNotification',
        index: 'studentNotification_deadlineId_idx_afd6391f',
        columns: ['deadlineId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'studentNotification',
        index: 'studentNotification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'studentNotification',
        index: 'studentNotification_userId_isRead_idx_b0140cd3',
        columns: ['userId', 'isRead'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'studentNotification',
        foreignKey: {
          name: 'studentNotification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
