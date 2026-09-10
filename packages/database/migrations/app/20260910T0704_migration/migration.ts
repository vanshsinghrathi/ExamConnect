#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6b7e63560eb040a8d865569e528910b9e462b9ad4ae0522a17e31b2dda984907/contract';
import startContract from '../../snapshots/6b7e63560eb040a8d865569e528910b9e462b9ad4ae0522a17e31b2dda984907/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b45ce5b045b591fc279bd48d5135507a65cf9316b691a4c471255156c42d6308/contract';
import endContract from '../../snapshots/b45ce5b045b591fc279bd48d5135507a65cf9316b691a4c471255156c42d6308/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'applicationDeadline',
        columns: [
          col('applicationEnd', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('applicationStart', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('applicationUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('examDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('examId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('postId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'post',
        columns: [
          col('code', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('examId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'eligibilityRule',
        column: col('postId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'applicationDeadline',
        index: 'applicationDeadline_applicationEnd_idx_8a3a84c5',
        columns: ['applicationEnd'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'applicationDeadline',
        index: 'applicationDeadline_examId_idx_a57bdadd',
        columns: ['examId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'applicationDeadline',
        index: 'applicationDeadline_postId_idx_a7a72715',
        columns: ['postId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'eligibilityRule',
        index: 'eligibilityRule_postId_idx_a7a72715',
        columns: ['postId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_examId_idx_a57bdadd',
        columns: ['examId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'applicationDeadline',
        foreignKey: {
          name: 'applicationDeadline_examId_fkey',
          columns: ['examId'],
          references: { schema: 'public', table: 'exam', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'applicationDeadline',
        foreignKey: {
          name: 'applicationDeadline_postId_fkey',
          columns: ['postId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'post',
        foreignKey: {
          name: 'post_examId_fkey',
          columns: ['examId'],
          references: { schema: 'public', table: 'exam', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'eligibilityRule',
        foreignKey: {
          name: 'eligibilityRule_postId_fkey',
          columns: ['postId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
