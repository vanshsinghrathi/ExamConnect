#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/9065e2c473dbaf97619e749777cd8c1ba077b0828f0cff6c068d1998ef505559/contract';
import startContract from '../../snapshots/9065e2c473dbaf97619e749777cd8c1ba077b0828f0cff6c068d1998ef505559/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ed1eb86ae1a3ef912da93cd8c01dea01e0bae449d9494a003719c03f3805fcbb/contract';
import endContract from '../../snapshots/ed1eb86ae1a3ef912da93cd8c01dea01e0bae449d9494a003719c03f3805fcbb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('department', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('qualification', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('vacancies', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
