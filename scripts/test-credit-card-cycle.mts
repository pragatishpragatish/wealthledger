import {
  getCreditCardCycle,
  getCreditCardDisplayDueDate,
  toDateString,
} from "../utils/date";

function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function check(
  from: string,
  billingDay: number,
  dueDay: number,
  expected: {
    nextStatement: string;
    nextDue: string;
    lastStatement: string;
    currentDue: string;
  }
) {
  const [y, m, d] = from.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const cycle = getCreditCardCycle(billingDay, dueDay, date);
  assertEqual(toDateString(cycle.nextStatementDate), expected.nextStatement, `${from} nextStatement`);
  assertEqual(toDateString(cycle.nextDueDate), expected.nextDue, `${from} nextDue`);
  assertEqual(toDateString(cycle.lastStatementDate), expected.lastStatement, `${from} lastStatement`);
  assertEqual(toDateString(cycle.currentStatementDueDate), expected.currentDue, `${from} currentDue`);
}

// User example: Aug 11, billing 1, due 28
check("2026-08-11", 1, 28, {
  nextStatement: "2026-09-01",
  nextDue: "2026-09-28",
  lastStatement: "2026-08-01",
  currentDue: "2026-08-28",
});

// Before billing day
check("2026-08-01", 5, 20, {
  nextStatement: "2026-08-05",
  nextDue: "2026-08-20",
  lastStatement: "2026-07-05",
  currentDue: "2026-07-20",
});

// On billing day → next statement is following month
check("2026-08-01", 1, 28, {
  nextStatement: "2026-09-01",
  nextDue: "2026-09-28",
  lastStatement: "2026-08-01",
  currentDue: "2026-08-28",
});

// After billing day
check("2026-08-15", 10, 25, {
  nextStatement: "2026-09-10",
  nextDue: "2026-09-25",
  lastStatement: "2026-08-10",
  currentDue: "2026-08-25",
});

// Year boundary
check("2026-12-15", 1, 28, {
  nextStatement: "2027-01-01",
  nextDue: "2027-01-28",
  lastStatement: "2026-12-01",
  currentDue: "2026-12-28",
});

// Short month clamp (billing 31 in Feb leap year path via Jan 31 after)
check("2026-01-31", 31, 31, {
  nextStatement: "2026-02-28",
  nextDue: "2026-02-28",
  lastStatement: "2026-01-31",
  currentDue: "2026-01-31",
});

// Display due: unbilled → next cycle due
{
  const due = getCreditCardDisplayDueDate(
    1,
    28,
    0,
    new Date(2026, 7, 11)
  );
  assertEqual(toDateString(due), "2026-09-28", "display due unbilled");
}

// Display due: open statement → current statement due
{
  const due = getCreditCardDisplayDueDate(
    1,
    28,
    5000,
    new Date(2026, 7, 11)
  );
  assertEqual(toDateString(due), "2026-08-28", "display due billed");
}

console.log("All credit-card cycle checks passed.");
