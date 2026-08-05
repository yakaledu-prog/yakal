// Two subscribers on one realtime topic, which is what the sidebar badge and
// the notification bell are.
//
// The Supabase client caches channels by topic, so the second subscriber gets
// the first one's channel back. Calling .on("postgres_changes", ...) on a
// channel that has already subscribed throws, and because both of these mount
// in the same commit, it threw inside an effect and took the whole dashboard
// down through the error boundary. Ref-counting is what stops that, so this
// asserts the counting rather than the happy path.
import { subscribeToNotifications } from "../../src/services/notificationService.ts";
import { subscribeToMessages } from "../../src/services/messageService.ts";

const USER = "39b5cc44-5ce1-4822-9414-01c27a9bb940";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? "  " + detail : ""}`);
  if (!ok) failures++;
}

function main() {
  // The exact shape that crashed: bell subscribes, badge subscribes after.
  let first: (() => void) | null = null;
  let second: (() => void) | null = null;
  try {
    first = subscribeToNotifications(USER, () => {});
    second = subscribeToNotifications(USER, () => {});
    check("two notification subscribers on one user do not throw", true);
  } catch (e) {
    check("two notification subscribers on one user do not throw", false, String(e));
  }

  // Releasing one must leave the other's subscription working, so the bell
  // does not go deaf when a page with a badge unmounts.
  try {
    first?.();
    const third = subscribeToNotifications(USER, () => {});
    check("a third subscriber after one released still works", true);
    third();
    second?.();
    check("releasing every subscriber tears the channel down", true);
  } catch (e) {
    check("releasing subscribers behaves", false, String(e));
  }

  // A double release must not drop the count below the live subscribers.
  try {
    const a = subscribeToNotifications(USER, () => {});
    const b = subscribeToNotifications(USER, () => {});
    a();
    a();
    const c = subscribeToNotifications(USER, () => {});
    check("a double unsubscribe does not close the channel early", true);
    b();
    c();
  } catch (e) {
    check("a double unsubscribe does not close the channel early", false, String(e));
  }

  // The same guarantee the messages channel already had, kept honest.
  try {
    const m1 = subscribeToMessages(() => {});
    const m2 = subscribeToMessages(() => {});
    m1();
    m2();
    check("messages keeps its existing ref-counting", true);
  } catch (e) {
    check("messages keeps its existing ref-counting", false, String(e));
  }

  console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
