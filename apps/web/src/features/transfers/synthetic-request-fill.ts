import { utcToManilaLocal } from "../../services/api/request-details";
import type { RequesterFields } from "./requester-request-fields";

/** Small, readable PDF containing fictional demo text only; kept in browser memory until submission. */
function syntheticPdf(name: string, lines: string[]): File {
  const escape = (value: string) => value.replace(/([\\()])/g, "\\$1");
  const stream = `BT /F1 11 Tf 50 790 Td ${lines.map((line, index) => `${index ? "0 -18 Td " : ""}(${escape(line)}) Tj`).join("\n")} ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => { const offset = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; return offset; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new File([pdf], name, { type: "application/pdf" });
}

/** Fills lower request sections only. Supply bank, product, quantity and urgency are deliberately absent. */
export function syntheticRequestFields(previous: RequesterFields, now = Date.now()): RequesterFields {
  let code = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  if (previous.pickupAuthorizationReference === `SYN-AUTH-${code}`) code = ((parseInt(code, 16) + 1) % 0x1000000).toString(16).padStart(6, "0").toUpperCase();
  let staffNumber = parseInt(code, 16) % 10_000;
  if (previous.staffId === `SYN-STAFF-${String(staffNumber).padStart(4, "0")}`) staffNumber = (staffNumber + 1) % 10_000;
  let requiredAt = now + (48 * 60 + parseInt(code, 16) % (24 * 60)) * 60_000;
  if (utcToManilaLocal(new Date(requiredAt).toISOString()) === previous.requiredLocal) requiredAt += 60_000;
  const fields: RequesterFields = {
    requestingPerson: `Synthetic Requester ${code}`,
    staffId: `SYN-STAFF-${String(staffNumber).padStart(4, "0")}`,
    attendingPhysician: `Synthetic Physician ${code}`,
    requiredLocal: utcToManilaLocal(new Date(requiredAt).toISOString()),
    pickupRepresentative: `Synthetic Courier ${code}`,
    pickupAuthorizationReference: `SYN-AUTH-${code}`,
    notes: `Synthetic demonstration request ${code}. Please coordinate pickup with the stated representative.`,
    files: {},
  };
  const notice = "SIMULATION_ONLY - fictional demonstration document. Not signed or verified.";
  fields.files = {
    REQUEST_FORM: syntheticPdf(`synthetic-request-form-${code}.pdf`, ["Synthetic Blood Request Supporting Form", notice, `Requesting person: ${fields.requestingPerson}`, `Staff ID: ${fields.staffId}`, `Physician: ${fields.attendingPhysician}`, `Required (Asia/Manila): ${fields.requiredLocal}`, `Notes: Synthetic demonstration request ${code}.`]),
    PICKUP_AUTHORIZATION: syntheticPdf(`synthetic-pickup-authorization-${code}.pdf`, ["Synthetic Pickup Supporting Document", notice, `Representative: ${fields.pickupRepresentative}`, `Reference: ${fields.pickupAuthorizationReference}`, "Fictional sample only; not evidence of identity or pickup authority."]),
  };
  return fields;
}
