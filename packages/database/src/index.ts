import { config } from "dotenv";
import { Temporal } from "@js-temporal/polyfill";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../prisma/contract.json" with { type: "json" };
import type { Contract } from "../prisma/contract.d.ts";

config({
  path: "../../.env",
});

type TemporalGlobal = typeof globalThis & {
  Temporal?: typeof Temporal;
};

const temporalGlobal = globalThis as TemporalGlobal;

if (!temporalGlobal.Temporal) {
  temporalGlobal.Temporal = Temporal;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured");
}

export const db = postgres<Contract>({
  contractJson,
  url: databaseUrl,
});