import { describe, expect, it } from "vitest";
import {
  accountStatusOf,
  canSendInvitation,
  contactStatusOf,
  describeDoctorProvisioning,
  hasDashboardAccess,
  type DoctorProvisioningInput,
} from "@/lib/doctor/provisioning";

// The rule these tests defend: nothing reports a doctor as READY on the
// strength of an assertion. "Can sign in" must mean an auth identity is
// actually linked to a live row — the same predicate requireDoctorContext
// enforces on every request — so the Super Admin console and the API can never
// disagree about who has access.

function doctor(over: Partial<DoctorProvisioningInput> = {}): DoctorProvisioningInput {
  return {
    email: null,
    phone: null,
    supabaseUserId: null,
    // Explicitly null, never omitted: left `undefined`, every `!== null` check
    // downstream reads as "linked" and the whole suite inverts.
    supabasePhoneUserId: null,
    isActive: true,
    deletedAt: null,
    provisioningStatus: "CONTACT_REQUIRED",
    ...over,
  };
}

describe("hasDashboardAccess", () => {
  it("is false with no linked auth identity, however complete the profile", () => {
    expect(
      hasDashboardAccess(
        doctor({
          email: "confirmed@example.com",
          phone: "+919820000001",
          provisioningStatus: "READY_TO_INVITE",
        }),
      ),
    ).toBe(false);
  });

  it("is false for an INVITED doctor — an invitation is not an account", () => {
    expect(
      hasDashboardAccess(
        doctor({ email: "confirmed@example.com", provisioningStatus: "INVITED" }),
      ),
    ).toBe(false);
  });

  it("is true only when a live row carries a linked auth identity", () => {
    expect(
      hasDashboardAccess(
        doctor({
          email: "confirmed@example.com",
          supabaseUserId: "auth-uid-1",
          provisioningStatus: "ACTIVE",
        }),
      ),
    ).toBe(true);
  });

  it("is false once the row is deactivated or soft-deleted, matching the API guard", () => {
    const linked = { supabaseUserId: "auth-uid-1", provisioningStatus: "ACTIVE" } as const;
    expect(hasDashboardAccess(doctor({ ...linked, isActive: false }))).toBe(false);
    expect(hasDashboardAccess(doctor({ ...linked, deletedAt: new Date() }))).toBe(false);
  });

  // ── The mobile identity ───────────────────────────────────────────────────
  // requireDoctorContext matches EITHER identity column, so this predicate has
  // to as well. While it read only `supabaseUserId`, the Super Admin console
  // showed "no dashboard access" for a doctor the API was letting straight in
  // — precisely the disagreement the comment on this function forbids.

  it("is true for a doctor linked by mobile alone", () => {
    expect(
      hasDashboardAccess(
        doctor({
          phone: "+919820000001",
          supabaseUserId: null,
          supabasePhoneUserId: "phone-auth-uid",
          provisioningStatus: "ACTIVE",
        }),
      ),
    ).toBe(true);
  });

  it("is true for a doctor carrying both identities", () => {
    expect(
      hasDashboardAccess(
        doctor({
          email: "doctor@example.com",
          phone: "+919820000001",
          supabaseUserId: "email-auth-uid",
          supabasePhoneUserId: "phone-auth-uid",
          provisioningStatus: "ACTIVE",
        }),
      ),
    ).toBe(true);
  });

  it("still refuses a mobile-linked doctor once deactivated or removed", () => {
    const phoneLinked = {
      supabasePhoneUserId: "phone-auth-uid",
      provisioningStatus: "ACTIVE",
    } as const;
    expect(hasDashboardAccess(doctor({ ...phoneLinked, isActive: false }))).toBe(false);
    expect(hasDashboardAccess(doctor({ ...phoneLinked, deletedAt: new Date() }))).toBe(
      false,
    );
  });
});

describe("contactStatusOf", () => {
  it("reports CONTACT_REQUIRED when nothing at all is on file", () => {
    expect(contactStatusOf(doctor())).toBe("CONTACT_REQUIRED");
  });

  it("reports UNCONFIRMED for an address nobody has confirmed as personal", () => {
    // The state that matters: a contact exists in the column, but the row is
    // still CONTACT_REQUIRED because no human vouched for it. Reporting this
    // as CONFIRMED is how a clinic reception address becomes a doctor login.
    expect(
      contactStatusOf(doctor({ email: "enquiries@clinic.example" })),
    ).toBe("UNCONFIRMED");
  });

  it("reports CONFIRMED once the row has moved past CONTACT_REQUIRED", () => {
    expect(
      contactStatusOf(
        doctor({ email: "doctor@example.com", provisioningStatus: "READY_TO_INVITE" }),
      ),
    ).toBe("CONFIRMED");
  });

  it("accepts a mobile alone — WhatsApp is a first-class invitation channel", () => {
    expect(
      contactStatusOf(
        doctor({ phone: "+919820000001", provisioningStatus: "READY_TO_INVITE" }),
      ),
    ).toBe("CONFIRMED");
  });
});

describe("accountStatusOf", () => {
  it("separates deactivated from removed", () => {
    expect(accountStatusOf(doctor())).toBe("ACTIVE");
    expect(accountStatusOf(doctor({ isActive: false }))).toBe("DEACTIVATED");
    expect(accountStatusOf(doctor({ deletedAt: new Date() }))).toBe("REMOVED");
  });

  it("reports a soft-deleted row as REMOVED even when isActive is still true", () => {
    expect(accountStatusOf(doctor({ deletedAt: new Date(), isActive: true }))).toBe(
      "REMOVED",
    );
  });
});

describe("describeDoctorProvisioning", () => {
  it("names the missing thing rather than a status that reads as progress", () => {
    const view = describeDoctorProvisioning(doctor());
    expect(view.dashboardAccess).toBe(false);
    expect(view.contactStatus).toBe("CONTACT_REQUIRED");
    expect(view.blockedReason).toMatch(/no personal login contact/i);
  });

  it("distinguishes an unconfirmed contact from a confirmed, uninvited one", () => {
    expect(
      describeDoctorProvisioning(doctor({ email: "enquiries@clinic.example" }))
        .blockedReason,
    ).toMatch(/unconfirmed/i);
    expect(
      describeDoctorProvisioning(
        doctor({ email: "doctor@example.com", provisioningStatus: "READY_TO_INVITE" }),
      ).blockedReason,
    ).toMatch(/invitation not sent/i);
    expect(
      describeDoctorProvisioning(
        doctor({ email: "doctor@example.com", provisioningStatus: "INVITED" }),
      ).blockedReason,
    ).toMatch(/not yet accepted/i);
  });

  it("gives a doctor who can sign in no blocked reason at all", () => {
    const view = describeDoctorProvisioning(
      doctor({
        email: "doctor@example.com",
        supabaseUserId: "auth-uid-1",
        provisioningStatus: "ACTIVE",
      }),
    );
    expect(view.dashboardAccess).toBe(true);
    expect(view.blockedReason).toBeNull();
  });
});

describe("canSendInvitation", () => {
  it("refuses without a confirmed personal contact", () => {
    expect(canSendInvitation(doctor())).toBe(false);
    expect(canSendInvitation(doctor({ email: "enquiries@clinic.example" }))).toBe(false);
  });

  it("refuses on a deactivated row", () => {
    expect(
      canSendInvitation(
        doctor({
          email: "doctor@example.com",
          provisioningStatus: "READY_TO_INVITE",
          isActive: false,
        }),
      ),
    ).toBe(false);
  });

  it("refuses when an account already exists — there is nothing to invite them to", () => {
    expect(
      canSendInvitation(
        doctor({
          email: "doctor@example.com",
          supabaseUserId: "auth-uid-1",
          provisioningStatus: "ACTIVE",
        }),
      ),
    ).toBe(false);
  });

  it("allows exactly the confirmed, live, unlinked case", () => {
    expect(
      canSendInvitation(
        doctor({ email: "doctor@example.com", provisioningStatus: "READY_TO_INVITE" }),
      ),
    ).toBe(true);
  });
});
