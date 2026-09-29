import { deleteAllQaSongs, deleteRunEvents } from "./helpers";

export default async function globalTeardown() {
  const removed = await deleteAllQaSongs();
  if (removed) console.log(`[teardown] removed ${removed} leftover QA song(s)`);
  const start = Number(process.env.QA_EVENTS_START_ID);
  if (Number.isFinite(start) && start > 0) {
    const events = await deleteRunEvents(start);
    if (events) console.log(`[teardown] removed ${events} song-less event(s) created by this run`);
  }
}
