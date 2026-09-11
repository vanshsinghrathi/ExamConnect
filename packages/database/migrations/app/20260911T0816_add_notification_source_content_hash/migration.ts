#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8be37be02911c44d313b1db45ccde66c76824713115e4568d70a0e0e0c8a5874/contract';
import startContract from '../../snapshots/8be37be02911c44d313b1db45ccde66c76824713115e4568d70a0e0e0c8a5874/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9065e2c473dbaf97619e749777cd8c1ba077b0828f0cff6c068d1998ef505559/contract';
import endContract from '../../snapshots/9065e2c473dbaf97619e749777cd8c1ba077b0828f0cff6c068d1998ef505559/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'notificationSource',
        column: col('contentHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
