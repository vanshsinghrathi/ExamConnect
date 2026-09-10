#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a0cc23ab12639c23337f1c9d364838ff8afc3e49639023e539d9412d1aaa3876/contract';
import startContract from '../../snapshots/a0cc23ab12639c23337f1c9d364838ff8afc3e49639023e539d9412d1aaa3876/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d73eea6b817381b16c7382bef06c6224e66c7ef519779a3977e7a18231cc33fa/contract';
import endContract from '../../snapshots/d73eea6b817381b16c7382bef06c6224e66c7ef519779a3977e7a18231cc33fa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'eligibilityRule',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('examId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ruleType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        columns: [
          col('conditionField', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('effectiveFrom', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('effectiveTo', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('eligibilityRuleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('expectedValue', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('operator', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('versionNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'eligibilityRule',
        index: 'eligibilityRule_examId_idx_a57bdadd',
        columns: ['examId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        index: 'eligibilityRuleVersion_eligibilityRuleId_idx_9f2f45a7',
        columns: ['eligibilityRuleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'eligibilityRule',
        foreignKey: {
          name: 'eligibilityRule_examId_fkey',
          columns: ['examId'],
          references: { schema: 'public', table: 'exam', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        foreignKey: {
          name: 'eligibilityRuleVersion_eligibilityRuleId_fkey',
          columns: ['eligibilityRuleId'],
          references: { schema: 'public', table: 'eligibilityRule', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
