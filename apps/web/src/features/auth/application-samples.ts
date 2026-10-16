export type ApplicationCategory = "BLOOD_BANK" | "REQUESTOR";
export interface SampleDocument { name: string; content: string }
export const applicationDocumentTitles = (bank: boolean) => bank
  ? ["Hospital / Health Facility LTO", "DOH Blood Service Facility LTO", "BSF assessment, personnel and equipment documents"]
  : ["Hospital / Health Facility LTO", "Blood Station ATO or transfusion-service authorization", "Referral agreement or facility capability documents"];

// Catalog identity stays stable when the applicant edits the draft. The backend
// will own registered/deleted eligibility; this catalog does not create accounts.
export const applicationSamples = (["BLOOD_BANK", "REQUESTOR"] as const).flatMap(category =>
  ["Acacia", "Narra", "Molave", "Yakal", "Talisay"].map((name, index) => ({
    id: `SAMPLE_${category === "BLOOD_BANK" ? "BANK" : "REQUESTOR"}_0${index + 1}`,
    category,
    name: `Synthetic ${name} ${category === "BLOOD_BANK" ? "Blood Bank" : "Requestor Facility"}`,
    number: index + 1,
  })));

export function makeSampleDocument(title: string, facility: string): SampleDocument {
  return {
    name: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "") + ".txt",
    content: ["BLOODLEDGER_SYNTHETIC_APPLICATION_DOCUMENT_V1", `Facility: ${facility || "Synthetic facility draft"}`, `Document: ${title}`, "Synthetic example only. No licensing or verification claim."].join("\n"),
  };
}

export function createSampleDraft(id: string) {
  const sample = applicationSamples.find(item => item.id === id);
  if (!sample) throw Error("Unknown application sample.");
  const bank = sample.category === "BLOOD_BANK";
  const slug = sample.id.toLowerCase().replace(/_/g, "-");
  const random = crypto.getRandomValues(new Uint8Array(18));
  const password = "Sample-" + Array.from(random, value => value.toString(16).padStart(2, "0")).join("");
  const expiration = new Date();
  expiration.setUTCFullYear(expiration.getUTCFullYear() + 2);
  const fields: Record<string, string> = {
    institutionDisplayName: sample.name,
    legalName: sample.name + " Demonstration Association",
    ownership: sample.number % 2 ? "Private" : "Government",
    facilityClassification: "Level 2 Hospital",
    address: `${100 + sample.number} Synthetic Training Avenue`,
    locality: "Lipa City",
    province: "Batangas",
    officialPhone: `SYNTH-PHONE-${sample.id}`,
    genericContact: `office@${slug}.example.invalid`,
    facilityLto: `SYNTH-FACILITY-LTO-${sample.id}`,
    facilityLtoExpiration: expiration.toISOString().slice(0, 10),
    bsfCategory: "Blood Bank",
    licenseReference: `SYNTH-${bank ? "BSF-LTO" : "RECEIVING-AUTH"}-${sample.id}`,
    authorityExpiration: expiration.toISOString().slice(0, 10),
    facilityHead: `Synthetic Facility Head ${sample.number}`,
    physicianLicense: `SYNTH-PHYSICIAN-${sample.id}`,
    technologist: `Synthetic Technologist ${sample.number}`,
    technologistLicense: `SYNTH-TECHNOLOGIST-${sample.id}`,
    referralFacility: "Synthetic Referral Blood Bank",
    applicationReason: bank ? "SYNTHETIC_BLOOD_SUPPLY_PARTICIPATION" : "SYNTHETIC_REQUEST_AND_RECEIPT_PARTICIPATION",
    applicantName: `Synthetic Applicant ${sample.id}`,
    officialPosition: bank ? "Blood Bank Head" : "Facility Administrator",
    employeeReference: `SYNTH-STAFF-${sample.id}`,
    accountEmail: `account@${slug}.example.invalid`,
    password,
  };
  const documents = Object.fromEntries(applicationDocumentTitles(bank).map(title => [title, makeSampleDocument(title, sample.name)]));
  return { sampleId: sample.id, fields, confirmation: password, documents };
}

export function chooseApplicationSample(category: ApplicationCategory, seen: string[], current?: string) {
  const catalog = applicationSamples.filter(item => item.category === category);
  // Avoid repeats within a preview cycle. Filling is not account registration:
  // after all five previews, begin another cycle without repeating the last one.
  let available = catalog.filter(item => !seen.includes(item.id));
  const reset = available.length === 0;
  if (reset) available = catalog.filter(item => item.id !== current);
  const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
  const sample = available[Math.floor(random * available.length)];
  return { id: sample.id, seen: [...(reset ? [] : seen), sample.id] };
}
