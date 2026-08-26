import { describe, expect, it } from "vitest";
import { can, composition, type Principal } from "./auth/permissions";
const principal = (permissions: Principal["permissions"]): Principal => ({ userId: "USR_SYNTH_01", displayName: "Synthetic operator", institutionId: "INST_SYNTH_01", institutionDisplayName: "Synthetic Hospital 01", roleId: "ROLE-01", roleDisplayName: "Medical Technologist", permissions, classification: "SIMULATION_ONLY" });
describe("verified permissions", () => { it("defaults closed", () => expect(can(principal([]), "inventory:read")).toBe(false)); it("selects operational", () => expect(composition(principal(["dashboard:operational"]))).toBe("OPERATIONAL")); it("selects regulatory", () => expect(composition(principal(["dashboard:regulatory"]))).toBe("REGULATORY")); });
