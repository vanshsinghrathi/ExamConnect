#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/ed1eb86ae1a3ef912da93cd8c01dea01e0bae449d9494a003719c03f3805fcbb/contract';
import startContract from '../../snapshots/ed1eb86ae1a3ef912da93cd8c01dea01e0bae449d9494a003719c03f3805fcbb/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f69bbd6f0934e0f23ac2957da945eca744ab4fb7c4dbed627e1f5cc69b6d7f9d/contract';
import endContract from '../../snapshots/f69bbd6f0934e0f23ac2957da945eca744ab4fb7c4dbed627e1f5cc69b6d7f9d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        column: col('logicGroup', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        column: col('logicOperator', 'text', {
          notNull: true,
          default: lit('AND'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'eligibilityRuleVersion',
        index: 'eligibilityRuleVersion_logicGroup_idx_ad3c83d0',
        columns: ['logicGroup'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
