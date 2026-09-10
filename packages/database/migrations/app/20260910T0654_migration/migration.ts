#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6b7e63560eb040a8d865569e528910b9e462b9ad4ae0522a17e31b2dda984907/contract';
import endContract from '../../snapshots/6b7e63560eb040a8d865569e528910b9e462b9ad4ae0522a17e31b2dda984907/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d73eea6b817381b16c7382bef06c6224e66c7ef519779a3977e7a18231cc33fa/contract';
import startContract from '../../snapshots/d73eea6b817381b16c7382bef06c6224e66c7ef519779a3977e7a18231cc33fa/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'notificationSource',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dateImported', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lastVerifiedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('notificationDate', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('notificationIdentifier', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('notificationTitle', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('officialUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('organization', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        column: col('notificationSourceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        index: 'eligibilityRuleVersion_notificationSourceId_idx_9d960425',
        columns: ['notificationSourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notificationSource',
        index: 'notificationSource_organization_idx_976134b7',
        columns: ['organization'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        foreignKey: {
          name: 'eligibilityRuleVersion_notificationSourceId_fkey',
          columns: ['notificationSourceId'],
          references: { schema: 'public', table: 'notificationSource', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
