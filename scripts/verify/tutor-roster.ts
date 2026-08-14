import assert from "node:assert/strict";
import { mergeRosterIds } from "../../src/utils/tutorRoster.ts";

const ids = mergeRosterIds(["paid-before-booking"], ["legacy-session", "paid-before-booking"]);

assert.deepEqual(ids, ["paid-before-booking", "legacy-session"]);
console.log("ok    active enrolments appear before a first session without duplicating legacy students");
