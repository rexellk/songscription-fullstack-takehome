import { maxEventId } from "./helpers";

/** Remembers where the events table stood, so teardown can remove only the rows this run added. */
export default async function globalSetup() {
  process.env.QA_EVENTS_START_ID = String(await maxEventId());
}
