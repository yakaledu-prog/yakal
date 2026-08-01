import { useState } from "react";

// ============================================================
// A list beside a record on a desktop, one page at a time on a phone.
//
// Nine pages are built this way: courses beside sessions, students beside
// their record, children beside their dashboard. All of them stacked the two
// columns on a phone and capped the list at a third of the screen, so the list
// was cramped and the record began below the fold.
//
// Messaging already solved this by showing one column at a time and letting a
// tap move between them. This is that behaviour, extracted, so the nine pages
// agree rather than each inventing it.
// ============================================================

export function useMasterDetail() {
  // Only ever consulted below md. Desktop shows both columns whatever this is.
  const [showDetail, setShowDetail] = useState(false);

  return {
    showDetail,
    /** Call when something in the list is chosen. */
    openDetail: () => setShowDetail(true),
    /** The back arrow, which is why it only appears below md. */
    closeDetail: () => setShowDetail(false),
    /** Hidden on a phone once a record is open. */
    listClass: showDetail ? "hidden md:flex" : "flex",
    /** Hidden on a phone until one is. */
    detailClass: showDetail ? "flex" : "hidden md:flex",
  };
}
