import type { Migration } from "../migrate.js";
import { migration001Baseline } from "./001-baseline.js";
import { migration002BorrowersAndLoanHistory } from "./002-borrowers-and-loan-history.js";
import { migration003Holds } from "./003-holds.js";

export const allMigrations: Migration[] = [
  migration001Baseline,
  migration002BorrowersAndLoanHistory,
  migration003Holds,
];
