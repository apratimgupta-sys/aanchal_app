import { api } from "./api";
import type { OfficerProfile } from "../shared/types";

export type NewOfficer = {
  username: string;
  name: string;
  designation: string;
  homeOfficeId: number;
};

export type CreatedOfficer = {
  officer: OfficerProfile;
  temporaryPassword: string;
};

export function listOfficers(): Promise<OfficerProfile[]> {
  return api<OfficerProfile[]>("/officers");
}

export function createOfficer(officer: NewOfficer): Promise<CreatedOfficer> {
  return api<CreatedOfficer>("/officers", "POST", officer);
}

export function setOfficerActive(
  id: string,
  active: boolean,
): Promise<OfficerProfile> {
  return api<OfficerProfile>(`/officers/${encodeURIComponent(id)}`, "PATCH", {
    active,
  });
}

export function resetOfficerPassword(
  id: string,
): Promise<{ temporaryPassword: string }> {
  return api<{ temporaryPassword: string }>(
    `/officers/${encodeURIComponent(id)}/password-reset`,
    "POST",
    {},
  );
}
