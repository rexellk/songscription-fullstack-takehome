import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db, deleteSongsByTitle, makeUniqueMidi, maxEventId, type Fixture } from "./helpers";

const SONGS_API = /\/rest\/v1\/songs(\?|$)/;
const FIXTURES = path.join(__dirname, "fixtures");

/** Titles created by the current test; deleted in afterEach. */
let created: string[] = [];

test.afterEach(async () => {
  await deleteSongsByTitle(created);
  created = [];
});

function fixture(): Fixture {
  const f = makeUniqueMidi();
  created.push(f.title);
  return f;
}

/** The "All songs" grid. Up next also renders <article>s, so everything card-related is scoped here. */
const grid = (page: Page) => page.getByRole("list", { name: "Songs" });
const cards = (page: Page) => grid(page).getByRole("article");
const card = (page: Page, title: string) =>
  cards(page).filter({ has: page.getByRole("button", { name: title, exact: true }) });
const cardTitle = (page: Page, title: string) => card(page, title).getByRole("button", { name: title, exact: true });
const drawerFor = (page: Page, title: string) => page.getByRole("dialog", { name: title, exact: true });

const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

const isPatch = (r: { url(): string; request(): { method(): string } }) =>
  SONGS_API.test(r.url()) && r.request().method() === "PATCH";

async function openLibrary(page: Page) {
  await page.goto("/");
  // The grid is ready once the real list replaces the loading skeletons.
  await expect(grid(page)).toBeVisible();
}

async function upload(page: Page, filePath: string) {
  await page.locator('input[type="file"]').setInputFiles(filePath);
}

/** Uploads a fresh QA song and waits for its real card. */
async function addQaSong(page: Page) {
  const f = fixture();
  await upload(page, f.filePath);
  await expect(card(page, f.title)).toBeVisible();
  await expect(toast(page, `Added ${f.title}`)).toBeVisible();
  return f;
}

async function openDrawer(page: Page, title: string) {
  await cardTitle(page, title).click();
  const drawer = drawerFor(page, title);
  await expect(drawer).toBeVisible();
  return drawer;
}

/** True when the element (or its ::after, used by the stretched card button) draws a real outline. */
async function hasVisibleFocusRing(el: Locator) {
  return el.evaluate((node) => {
    const drawn = (s: CSSStyleDeclaration) =>
      s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && s.outlineColor !== "rgba(0, 0, 0, 0)";
    return drawn(getComputedStyle(node)) || drawn(getComputedStyle(node, "::after"));
  });
}

test.describe("upload", () => {
  test("1. upload shows the optimistic skeleton, then the card, then the success toast", async ({ page }) => {
    const f = fixture();
    await openLibrary(page);

    // Slow the storage upload a little so the optimistic state is observable.
    await page.route(/\/storage\/v1\/object\/midi\//, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await upload(page, f.filePath);
    const skeleton = page.getByLabel(`Adding ${path.basename(f.filePath)}`);
    await expect(skeleton).toBeVisible();
    await expect(skeleton).toContainText("Reading notes…");

    await expect(card(page, f.title)).toBeVisible();
    await expect(skeleton).toHaveCount(0);
    await expect(toast(page, `Added ${f.title}`)).toBeVisible();

    // 2. Persistence: still there after a reload.
    await page.reload();
    await expect(card(page, f.title)).toBeVisible();
  });

  test("1b. dropping a file anywhere on the page shows the drop target and adds the song", async ({ page }) => {
    const f = fixture();
    await openLibrary(page);
    const bytes = readFileSync(f.filePath).toString("base64");
    const dt = await page.evaluateHandle(
      ({ b64, name }) => {
        const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const data = new DataTransfer();
        data.items.add(new File([bin], name, { type: "audio/midi" }));
        return data;
      },
      { b64: bytes, name: path.basename(f.filePath) },
    );
    await page.dispatchEvent("main", "dragenter", { dataTransfer: dt });
    await expect(page.getByText("Drop to add to your library")).toBeVisible();
    await page.dispatchEvent("main", "drop", { dataTransfer: dt });
    await expect(page.getByText("Drop to add to your library")).toHaveCount(0);
    await expect(card(page, f.title)).toBeVisible();
    await expect(toast(page, `Added ${f.title}`)).toBeVisible();
  });

  test("3. uploading the same file twice is caught, makes no second card, and opens that song's drawer", async ({
    page,
  }) => {
    await openLibrary(page);
    const f = await addQaSong(page);

    await upload(page, f.filePath);
    await expect(toast(page, "Already in your library")).toBeVisible();
    await expect(drawerFor(page, f.title)).toBeVisible();
    await expect(card(page, f.title)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(drawerFor(page, f.title)).toHaveCount(0);

    await page.reload();
    await expect(card(page, f.title)).toHaveCount(1);
  });

  for (const name of ["not-midi.txt", "fake.mid"]) {
    test(`4. a non-MIDI file (${name}) shows a friendly error and adds nothing`, async ({ page }) => {
      await openLibrary(page);
      const before = await cards(page).count();
      await upload(page, path.join(FIXTURES, name));
      await expect(toast(page, "That file isn't a MIDI file. Try a .mid file.")).toBeVisible();
      await expect(page.getByLabel(/^Adding /)).toHaveCount(0);
      expect(await cards(page).count()).toBe(before);
    });
  }
});

test.describe("favorites", () => {
  test("favorite toggle persists after reload", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const c = card(page, f.title);

    await c.hover();
    const heart = c.getByRole("button", { name: `Add ${f.title} to favorites` });
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    const saved = page.waitForResponse(isPatch);
    await heart.click();
    await expect(c.getByRole("button", { name: `Remove ${f.title} from favorites` })).toHaveAttribute("aria-pressed", "true");
    expect((await saved).ok()).toBe(true);

    await page.reload();
    await expect(card(page, f.title).getByRole("button", { name: `Remove ${f.title} from favorites` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // And back off again.
    const unsaved = page.waitForResponse(isPatch);
    await card(page, f.title).hover();
    await card(page, f.title).getByRole("button", { name: `Remove ${f.title} from favorites` }).click();
    expect((await unsaved).ok()).toBe(true);
    await page.reload();
    await expect(card(page, f.title).getByRole("button", { name: `Add ${f.title} to favorites` })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

test.describe("states", () => {
  test("loading shows 8 skeleton cards", async ({ page }) => {
    await page.route(SONGS_API, async (route) => {
      if (route.request().method() === "GET") await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await page.goto("/");
    const loading = page.getByLabel("Loading your library");
    await expect(loading).toBeVisible();
    await expect(loading.locator('[aria-busy="true"]')).toHaveCount(8);
    await expect(grid(page)).toBeVisible({ timeout: 20_000 });
    await expect(loading).toHaveCount(0);
  });

  test("empty library shows the onboarding empty state", async ({ page }) => {
    await page.route(SONGS_API, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
        : route.continue(),
    );
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Start your library" })).toBeVisible();
    await expect(page.getByText("Add a MIDI file of a song you want to learn.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Drop a MIDI file here or choose one/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try a sample" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load demo library" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
  });
});

test.describe("finding songs", () => {
  test("5. search filters the grid, shows 'N of M', and a miss shows no results + Clear filters", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const total = await cards(page).count();

    const search = page.getByRole("searchbox", { name: "Search your library" });
    await expect(search).toHaveAttribute("placeholder", "Search your library");
    await search.fill(f.title.toUpperCase()); // case-insensitive
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, f.title)).toBeVisible();
    await expect(page.getByText(`1 of ${total}`, { exact: true })).toBeVisible();

    // Escape in the box clears it.
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await expect(cards(page)).toHaveCount(total);
    await expect(page.getByText(`of ${total}`)).toHaveCount(0);

    await search.fill("zzzz no such song");
    await expect(page.getByRole("heading", { name: "No songs match “zzzz no such song”" })).toBeVisible();
    await expect(page.getByText(`0 of ${total}`, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(search).toHaveValue("");
    await expect(cards(page)).toHaveCount(total);
  });

  test("5b. '/' focuses search from anywhere on the page", async ({ page }) => {
    await openLibrary(page);
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Search your library" })).toBeFocused();
  });

  test("5c. search logs a search_used event with only query_length and result_count", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const since = await maxEventId();
    const query = f.title.slice(-6); // the random hex part, matches exactly one song
    await page.getByRole("searchbox", { name: "Search your library" }).fill(query);
    await expect(cards(page)).toHaveCount(1);
    await page.waitForTimeout(1500);

    let rows: { props: Record<string, unknown> }[] = [];
    await expect
      .poll(async () => {
        const { data } = await db().from("events").select("props").eq("name", "search_used").gt("id", since);
        rows = (data ?? []) as typeof rows;
        return rows.length;
      })
      .toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r.props).sort()).toEqual(["query_length", "result_count"]);
      expect(JSON.stringify(r.props)).not.toContain(query);
    }
    expect(rows.some((r) => r.props.query_length === query.length && r.props.result_count === 1)).toBe(true);
  });

  test("6. filter chips, key filter and sort change the visible set and order", async ({ page }) => {
    await openLibrary(page);
    const total = await cards(page).count();
    const chip = (name: string) => page.getByRole("group", { name: "Filter songs" }).getByRole("button", { name, exact: true });
    const titles = () => cards(page).getByRole("heading").allInnerTexts();

    await expect(chip("All")).toHaveAttribute("aria-pressed", "true");

    await chip("Favorites").click();
    await expect(chip("Favorites")).toHaveAttribute("aria-pressed", "true");
    await expect(chip("All")).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText(new RegExp(`^\\d+ of ${total}$`))).toBeVisible();
    await expect
      .poll(async () => {
        const n = await cards(page).count();
        const favs = await grid(page).getByRole("button", { name: /^Remove .* from favorites$/ }).count();
        return n > 0 && n === favs;
      })
      .toBe(true);

    for (const level of ["Easy", "Medium", "Hard"]) {
      await chip(level).click();
      await expect(chip(level)).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(async () => (await cards(page).allInnerTexts()).every((t) => t.includes(level)))
        .toBe(true);
    }
    await chip("All").click();
    await expect(cards(page)).toHaveCount(total);

    // Key filter: every visible card shows the chosen key in its meta line.
    const keySelect = page.getByRole("combobox", { name: "Filter by key" });
    const keys = (await keySelect.locator("option").allInnerTexts()).filter((k) => k !== "Any key");
    expect(keys.length).toBeGreaterThan(1);
    await keySelect.selectOption({ label: keys[0] });
    await expect
      .poll(async () => {
        const t = await cards(page).allInnerTexts();
        return t.length > 0 && t.length < total && t.every((x) => x.includes(keys[0]));
      })
      .toBe(true);
    await keySelect.selectOption({ label: "Any key" });
    await expect(cards(page)).toHaveCount(total);

    const sort = page.getByRole("combobox", { name: "Sort by" });
    await sort.selectOption({ label: "Title A to Z" });
    await expect
      .poll(async () => {
        const t = await titles();
        return JSON.stringify(t) === JSON.stringify([...t].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
      })
      .toBe(true);
    const az = await titles();
    await sort.selectOption({ label: "Recently added" });
    await expect.poll(titles).not.toEqual(az);
  });
});

test.describe("detail drawer", () => {
  test("7. drawer opens by click and Enter; closes by Escape, X and overlay; focus returns; page is inert", async ({
    page,
  }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const title = cardTitle(page, f.title);
    const drawer = drawerFor(page, f.title);
    const headerInert = () => page.evaluate(() => document.querySelector("header")?.closest("[inert]") !== null);

    // Click open, Escape close.
    await title.click();
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#drawer-title")).toHaveText(f.title);
    expect(await headerInert()).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    expect(await headerInert()).toBe(false);

    // Keyboard open, X close.
    await title.focus();
    await page.keyboard.press("Enter");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Close song details", exact: true }).click();
    await expect(drawer).toHaveCount(0);

    // Overlay click (left of the 460px panel) closes it.
    await title.click();
    await expect(drawer).toBeVisible();
    await page.mouse.click(40, 300);
    await expect(drawer).toHaveCount(0);
  });

  test("7c. closing the drawer returns focus to the card title (Escape and X)", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const title = cardTitle(page, f.title);
    const drawer = drawerFor(page, f.title);

    await title.focus();
    await page.keyboard.press("Enter");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(title).toBeFocused({ timeout: 3000 });

    await title.focus();
    await page.keyboard.press("Enter");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Close song details", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(title).toBeFocused({ timeout: 3000 });
  });

  test("7d. the drawer keeps its accessible name in practice mode", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);
    await drawer.getByRole("button", { name: "Practice", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("The interactive piano roll opens here.")).toBeVisible();
    await expect(dialog).toHaveAccessibleName(f.title, { timeout: 3000 });
  });

  test("7b. opening and closing a demo song's drawer is read-only and shows its details", async ({ page }) => {
    await openLibrary(page);
    const first = cards(page).first().getByRole("heading").getByRole("button");
    const name = (await first.innerText()).trim();
    await first.click();
    const drawer = drawerFor(page, name);
    await expect(drawer).toBeVisible();
    for (const h of ["About this song", "Hands", "Difficulty", "Your practice", "Progress", "Practice settings", "Feedback", "How does this transcription sound?", "Tags"]) {
      await expect(drawer.getByRole("heading", { name: h, exact: true })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("8. rating a transcription with a note persists after reload", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);

    const group = drawer.getByRole("radiogroup", { name: "How does this transcription sound?" });
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(drawer.getByPlaceholder("Which part? For example, the bridge")).toHaveCount(0);

    await group.getByRole("radio", { name: "A few parts are off" }).click();
    await expect(group.getByRole("radio", { name: "A few parts are off" })).toHaveAttribute("aria-checked", "true");
    const note = drawer.getByPlaceholder("Which part? For example, the bridge");
    await expect(note).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Skip" })).toBeVisible();
    await expect(drawer.getByText("Thanks, this helps improve transcriptions.")).toBeVisible();

    await note.fill("the left hand in bar 3");
    const saved = page.waitForResponse(isPatch);
    await drawer.getByRole("button", { name: "Save note" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(drawer.getByText("Thanks, this helps improve transcriptions.")).toBeVisible();
    await expect(drawer.getByText(/You said\s*.A few parts are off./)).toBeVisible();

    await page.reload();
    const again = await openDrawer(page, f.title);
    await expect(again.getByText(/You said\s*.A few parts are off./)).toBeVisible();
    await expect(again.getByText("“the left hand in bar 3”")).toBeVisible();
    await expect(again.getByRole("button", { name: "Change" })).toBeVisible();

    // Change: pick "Not usable" and skip the note; the old note is kept.
    await again.getByRole("button", { name: "Change" }).click();
    await again.getByRole("radio", { name: "Not usable" }).click();
    await expect(again.getByRole("radio", { name: "Not usable" })).toHaveAttribute("aria-checked", "true");
    await expect(again.getByPlaceholder("Which part? For example, the bridge")).toHaveValue("the left hand in bar 3");
    await again.getByPlaceholder("Which part? For example, the bridge").fill("");
    await again.getByRole("button", { name: "Skip" }).click();
    await expect(again.getByText(/You said\s*.Not usable./)).toBeVisible();

    // "Sounds right" needs no note.
    await again.getByRole("button", { name: "Change" }).click();
    await again.getByRole("radio", { name: "Sounds right" }).click();
    await expect(again.getByText(/You said\s*.Sounds right./)).toBeVisible();
    await expect(again.getByPlaceholder("Which part? For example, the bridge")).toHaveCount(0);
    await page.reload();
    await expect((await openDrawer(page, f.title)).getByText(/You said\s*.Sounds right./)).toBeVisible();
  });

  test("9. delete via inline confirmation removes the card, shows a toast, and stays gone after reload", async ({
    page,
  }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);

    await drawer.getByRole("button", { name: "Delete song" }).click();
    const confirm = drawer.getByRole("alertdialog", { name: "Delete this song?" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toHaveCount(0);
    await expect(drawer.getByRole("button", { name: "Delete song" })).toBeVisible();

    await drawer.getByRole("button", { name: "Delete song" }).click();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(card(page, f.title)).toHaveCount(0);
    await expect(toast(page, `Deleted ${f.title}`)).toBeVisible();
    await page.reload();
    await expect(grid(page)).toBeVisible();
    await expect(card(page, f.title)).toHaveCount(0);
    const { count } = await db().from("songs").select("id", { count: "exact", head: true }).eq("title", f.title);
    expect(count).toBe(0);
  });

  test("10b. the drawer traps focus (Tab and Shift+Tab)", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);
    const inside = () => drawer.evaluate((d) => d.contains(document.activeElement) && document.activeElement !== d);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
      seen.add(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) ?? ""));
    }
    expect(seen.size).toBeGreaterThan(5); // it actually cycles through the drawer's controls
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(await inside()).toBe(true);
    }
  });

  test("tags: add with Enter, remove with the x button, persists after reload", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);
    const input = drawer.getByRole("textbox", { name: "Add a tag" });

    let saved = page.waitForResponse(isPatch);
    await input.fill("QA Keep");
    await input.press("Enter");
    expect((await saved).ok()).toBe(true);
    await expect(drawer.getByRole("button", { name: "Remove tag qa keep" })).toBeVisible(); // normalized to lowercase
    await expect(input).toHaveValue("");

    saved = page.waitForResponse(isPatch);
    await input.fill("qa drop");
    await input.press("Enter");
    expect((await saved).ok()).toBe(true);
    await expect(drawer.getByRole("button", { name: "Remove tag qa drop" })).toBeVisible();

    saved = page.waitForResponse(isPatch);
    await drawer.getByRole("button", { name: "Remove tag qa drop" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(drawer.getByRole("button", { name: "Remove tag qa drop" })).toHaveCount(0);

    await page.reload();
    const again = await openDrawer(page, f.title);
    await expect(again.getByRole("button", { name: "Remove tag qa keep" })).toBeVisible();
    await expect(again.getByRole("button", { name: "Remove tag qa drop" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Search looks at tags too.
    await page.getByRole("searchbox", { name: "Search your library" }).fill("qa keep");
    await expect(cards(page)).toHaveCount(1);
    await expect(card(page, f.title)).toBeVisible();
  });

  test("per-song practice settings persist after reload and feed the practice view", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);
    const speed = drawer.getByRole("group", { name: "Speed" });
    const hands = drawer.getByRole("group", { name: "Hands" });

    await expect(speed.getByRole("radio", { name: /^Default/ })).toBeChecked();
    let saved = page.waitForResponse(isPatch);
    await speed.getByRole("radio", { name: "75%", exact: true }).check({ force: true });
    expect((await saved).ok()).toBe(true);
    await expect(speed.getByRole("radio", { name: "75%", exact: true })).toBeChecked();

    saved = page.waitForResponse(isPatch);
    await hands.getByRole("radio", { name: "Left", exact: true }).check({ force: true });
    expect((await saved).ok()).toBe(true);

    await page.reload();
    const again = await openDrawer(page, f.title);
    await expect(again.getByRole("group", { name: "Speed" }).getByRole("radio", { name: "75%", exact: true })).toBeChecked();
    await expect(again.getByRole("group", { name: "Hands" }).getByRole("radio", { name: "Left", exact: true })).toBeChecked();

    await again.getByRole("button", { name: "Practice", exact: true }).click();
    // In practice mode the dialog loses its name (see 7d), so find it by role only.
    await expect(page.getByRole("dialog").getByText("Practicing · 75% · left hand")).toBeVisible();
  });

  test("practice: placeholder, Back to details, and Progress shows Times practiced 1", async ({ page }) => {
    await openLibrary(page);
    const f = await addQaSong(page);
    const drawer = await openDrawer(page, f.title);
    await expect(drawer.getByText("You haven't practiced this song yet.", { exact: false })).toBeVisible();

    const saved = page.waitForResponse(isPatch);
    await drawer.getByRole("button", { name: "Practice", exact: true }).click();
    const dialog = page.getByRole("dialog"); // unnamed in practice mode, see 7d
    await expect(dialog.getByText("The interactive piano roll opens here.")).toBeVisible();
    expect((await saved).ok()).toBe(true);

    await dialog.getByRole("button", { name: "Back to details" }).click();
    await expect(drawer.getByText("The interactive piano roll opens here.")).toHaveCount(0);
    await expect(drawer.getByText("Times practiced", { exact: true }).locator("xpath=following-sibling::dd")).toHaveText("1");

    await page.reload();
    const again = await openDrawer(page, f.title);
    await expect(
      again.getByText("Times practiced", { exact: true }).locator("xpath=following-sibling::dd"),
    ).toHaveText("1");
  });
});

test.describe("settings and audio", () => {
  test("settings popover: Dark theme applies and survives reload, then reset to System", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openLibrary(page);
    const trigger = page.getByRole("button", { name: "Settings for Rexell" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    for (const t of ["Light", "Dark", "System"]) await expect(dialog.getByRole("radio", { name: t, exact: true })).toBeVisible();

    await dialog.getByRole("radio", { name: "Dark", exact: true }).check({ force: true });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Escape closes and returns focus to the avatar.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Settings for Rexell" }).click();
    await expect(dialog.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();

    await dialog.getByRole("radio", { name: "System", exact: true }).check({ force: true });
    await expect(dialog.getByRole("radio", { name: "System", exact: true })).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Clicking outside closes it.
    await page.mouse.click(40, 400);
    await expect(dialog).toHaveCount(0);
  });

  test("audio: the card's Play button switches to Pause", async ({ page }) => {
    let reachable = false;
    try {
      const res = await fetch("https://tonejs.github.io/audio/salamander/A4.mp3", {
        method: "HEAD",
        signal: AbortSignal.timeout(8000),
      });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
    test.skip(!reachable, "tonejs.github.io (piano samples) is not reachable from this machine");
    test.setTimeout(90_000);

    await openLibrary(page);
    const f = await addQaSong(page);
    const c = card(page, f.title);
    await c.hover();
    const play = c.getByRole("button", { name: `Play ${f.title}`, exact: true });
    await expect(play).toBeVisible();
    await play.click();
    const busy = c.getByRole("button", { name: new RegExp(`^(Pause|Loading preview of) ${f.title}$`) });
    await expect(busy).toBeVisible({ timeout: 10_000 });
    const pause = c.getByRole("button", { name: `Pause ${f.title}`, exact: true });
    await expect(pause).toBeVisible({ timeout: 45_000 });
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await pause.click();
    await expect(c.getByRole("button", { name: `Play ${f.title}`, exact: true })).toBeVisible();
  });
});

test.describe("keyboard and layout", () => {
  test("10. Tab order: header, Up next, toolbar, then cards, with a visible focus ring on every stop", async ({ page }) => {
    await openLibrary(page);
    await expect(cards(page).nth(1)).toBeVisible();
    const firstCard = cards(page).nth(0);
    const firstTitle = (await firstCard.getByRole("heading").innerText()).trim();
    const secondTitle = (await cards(page).nth(1).getByRole("heading").innerText()).trim();

    type Stop = { name: string; tag: string; region: string; ring: boolean; opacity: string; visible: boolean };
    const stops: Stop[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(250); // let opacity transitions on hover-revealed buttons finish
      const stop = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const drawn = (s: CSSStyleDeclaration) =>
          s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && s.outlineColor !== "rgba(0, 0, 0, 0)";
        const region = el.closest("header")
          ? "header"
          : el.closest('section[aria-labelledby="up-next-title"]')
            ? "upnext"
            : el.closest('ul[aria-label="Songs"]')
              ? "grid"
              : "toolbar";
        const r = el.getBoundingClientRect();
        let opacity = 1;
        for (let n: HTMLElement | null = el; n; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
        return {
          name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim(),
          tag: el.tagName.toLowerCase(),
          region,
          ring: drawn(getComputedStyle(el)) || drawn(getComputedStyle(el, "::after")),
          opacity: String(opacity),
          visible: r.width > 0 && r.height > 0,
        };
      });
      stops.push(stop);
      if (stop.region === "grid" && stop.name === secondTitle) break;
    }

    // Every stop is visible and shows the focus ring.
    for (const s of stops) {
      expect.soft(s.ring, `focus ring on ${s.tag} "${s.name}"`).toBe(true);
      expect.soft(s.visible && s.opacity === "1", `visible when focused: ${s.tag} "${s.name}"`).toBe(true);
    }

    const names = stops.map((s) => s.name);
    expect(names.slice(0, 2)).toEqual(["Add a song", "Settings for Rexell"]);

    // Regions come in order, each as one contiguous block.
    const regions = stops.map((s) => s.region).filter((r, i, a) => r !== a[i - 1]);
    expect(regions).toEqual(["header", "upnext", "toolbar", "grid"]);

    // Up next: every "Practice X" button comes right after the stop that opens X.
    const upnext = stops.filter((s) => s.region === "upnext");
    expect(upnext.length).toBeGreaterThanOrEqual(2);
    upnext.forEach((s, i) => {
      if (s.name.startsWith("Practice ")) expect(upnext[i - 1]?.name).toContain(s.name.replace(/^Practice /, ""));
    });

    // Toolbar: search, sort, the five chips, then the key filter.
    const toolbar = stops.filter((s) => s.region === "toolbar");
    expect(toolbar[0]).toMatchObject({ tag: "input", name: "Search your library" });
    expect(toolbar[1].tag).toBe("select");
    expect(toolbar.slice(2, 7).map((s) => s.name)).toEqual(["All", "Favorites", "Easy", "Medium", "Hard"]);
    expect(toolbar.slice(7).map((s) => s.tag)).toEqual(["select"]);

    // Cards: title, then its Play and favorite buttons, then the next card's title.
    const gridStops = stops.filter((s) => s.region === "grid").map((s) => s.name);
    expect(gridStops).toEqual([
      firstTitle,
      `Play ${firstTitle}`,
      expect.stringMatching(new RegExp(`^(Add ${firstTitle} to|Remove ${firstTitle} from) favorites$`)),
      secondTitle,
    ]);

    // The helper's check agrees for the first card title.
    await cards(page).nth(1).getByRole("heading").getByRole("button").focus();
    expect(await hasVisibleFocusRing(cards(page).nth(1).getByRole("heading").getByRole("button"))).toBe(true);
  });

  test("11. no horizontal scroll at 375px, with and without the drawer", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openLibrary(page);
    await expect(cards(page).first()).toBeVisible();
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);

    await cards(page).first().getByRole("heading").getByRole("button").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
  });
});
