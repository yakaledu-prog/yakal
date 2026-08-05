// Every template renders, and renders something a person could read.
//
// The check that matters is the type: notifications.type has a check
// constraint, so a template naming a type outside it inserts fine in a unit
// test and fails in production against a real database. The list here is read
// from the migration rather than retyped.
import { execFileSync } from "node:child_process";

import {
  TEMPLATE_KEYS,
  TEMPLATES,
  renderSample,
} from "../../src/lib/notifications/index.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok ? "" : `  ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

// Read from the running database, not from a migration file. The baseline
// carries the original list and later migrations have added to it since, so a
// file is only ever the answer as of whenever it was written.
const constraint = execFileSync(
  "psql",
  [
    process.env.LOCAL_DB ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "-tAc",
    "select pg_get_constraintdef(oid) from pg_constraint where conname = 'notifications_type_check'",
  ],
  { encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" } }
);

const allowed = new Set(
  constraint.match(/'([a-z_]+)'::text/g)?.map((s) => s.replace(/'|::text/g, "")) ?? []
);

check("the database's allowed types were read", allowed.size > 0, allowed.size);

for (const key of TEMPLATE_KEYS) {
  const template = TEMPLATES[key];
  const { notification, email } = renderSample(key);

  check(`${key}: type is one the database allows`, allowed.has(template.type), template.type);
  check(`${key}: notification has a title`, notification.title.trim().length > 0);
  check(`${key}: notification is one line`, !notification.message.includes("\n"));
  check(
    `${key}: notification message is short enough for a list row`,
    notification.message.length <= 140,
    notification.message.length
  );

  check(`${key}: email has a subject`, email.subject.trim().length > 0);
  check(`${key}: email has a heading`, email.heading.trim().length > 0);
  // The whole reason the two are written separately: an inbox has no context
  // around it, so the email has to say more than the list row does.
  check(
    `${key}: email says more than the notification`,
    email.intro.length > notification.message.length,
    { email: email.intro.length, notification: notification.message.length }
  );
  check(
    `${key}: no unreplaced placeholder survived`,
    !/undefined|null|\[object/.test(`${email.subject} ${email.intro} ${notification.message}`)
  );
}

const types = new Set(TEMPLATE_KEYS.map((k) => TEMPLATES[k].type));
check(
  "every allowed type has a template",
  [...allowed].every((t) => types.has(t as never)),
  [...allowed].filter((t) => !types.has(t as never))
);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
