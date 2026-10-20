import { expect, type Page } from "@playwright/test";

/** Synthetic-only UI check: Fill Up must not change supply choices or send any mutation. */
export async function checkRequestFillUp(page: Page) {
  page.setDefaultTimeout(10_000);
  const form = page.locator(".requester-request-form");
  let writes = 0;
  page.on("request", request => { if (request.method() === "POST") writes++; });
  await form.getByLabel("Blood type", { exact: true }).selectOption("B_NEGATIVE");
  await form.getByRole("combobox", { name: "Component", exact: true }).selectOption("PLATELETS");
  const refreshed = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === "/api/v2/eligible-suppliers" && url.searchParams.get("quantity") === "7";
  });
  await form.getByLabel("Quantity", { exact: true }).fill("7");await refreshed;
  await form.getByRole("combobox", { name: "Urgency", exact: true }).selectOption("CRITICAL");
  const supplier = form.getByLabel("Supplying blood bank", { exact: true });
  await expect(supplier).toBeEnabled();
  const bank = await supplier.locator("option").last().getAttribute("value");
  await supplier.selectOption(bank!);
  const supplyValues = async () => Promise.all([supplier, form.getByLabel("Blood type", { exact: true }), form.getByRole("combobox", { name: "Component", exact: true }), form.getByLabel("Quantity", { exact: true }), form.getByRole("combobox", { name: "Urgency", exact: true })].map(control => control.inputValue()));
  const selected = await supplyValues();
  const detailLabels = ["Requesting Person", "Employee / Staff ID", "Attending Physician", "Required Date & Time", "Pickup Representative", "ID / Authorization Reference", "Request notes"];
  const detailValues = async () => Promise.all(detailLabels.map(label => form.getByLabel(label, { exact: true }).inputValue()));
  await form.getByRole("button", { name: "Fill Up", exact: true }).click();
  const first = await detailValues();for (const value of first) expect(value).not.toBe("");
  await expect(form.getByLabel("Employee / Staff ID", { exact: true })).toHaveValue(/^SYN-STAFF-\d{4}$/);
  await expect(form.getByLabel("ID / Authorization Reference", { exact: true })).toHaveValue(/^SYN-AUTH-[A-F0-9]{6}$/);
  await expect(form.getByLabel("Patient / Case Reference", { exact: true })).toBeDisabled();
  const documents = form.locator(".requester-document-placeholders small");
  const firstFiles = await documents.allTextContents();expect(firstFiles).toHaveLength(2);
  expect(firstFiles[0]).toContain("synthetic-request-form-");expect(firstFiles[1]).toContain("synthetic-pickup-authorization-");
  expect(await supplyValues()).toEqual(selected);
  expect(await form.locator("form").evaluate(node => (node as HTMLFormElement).checkValidity())).toBe(true);
  await form.getByRole("button", { name: "Fill Up", exact: true }).click();
  const second = await detailValues();for (let i = 0; i < first.length; i++) expect(second[i]).not.toBe(first[i]);
  const secondFiles = await documents.allTextContents();for (let i = 0; i < firstFiles.length; i++) expect(secondFiles[i]).not.toBe(firstFiles[i]);
  expect(await supplyValues()).toEqual(selected);
  await expect(form.locator(".requester-submit-actions").getByRole("button")).toHaveText(["Fill Up", "Cancel", "Submit request"]);
  await expect(page.getByRole("dialog", { name: "Verify operator" })).toHaveCount(0);expect(writes).toBe(0);
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 844 });expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
}
