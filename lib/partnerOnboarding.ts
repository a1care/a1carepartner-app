export type PartnerRoleKey = "doctor" | "nurse" | "ambulance" | "rental";

export const PARTNER_ROLE_IDS: Record<PartnerRoleKey, string> = {
    doctor: "692c582d17fa4521fcd5a940",
    nurse: "6968b066a32d6eb67e8b7c74",
    ambulance: "699946a786e3fd517d046316",
    rental: "699946a786e3fd517d04631a",
};

export const REQUIRED_DOCUMENTS: Record<PartnerRoleKey, string[]> = {
    doctor: ["Selfie", "Aadhar Card", "PAN Card", "Medical Degree Certificate", "MCI/State Registration"],
    nurse: ["Selfie", "Aadhar Card", "PAN Card", "Nursing Certificate", "Registration Document"],
    ambulance: ["Selfie", "Aadhar Card", "PAN Card", "Vehicle RC", "Commercial DL", "Fitness Certificate"],
    rental: ["Selfie", "Aadhar Card", "PAN Card", "Business License", "GST Registration", "Shop Certificate"],
};

export const normalizePartnerRole = (role?: string | null): PartnerRoleKey => {
    const normalized = String(role || "").toLowerCase();
    return normalized in REQUIRED_DOCUMENTS ? normalized as PartnerRoleKey : "doctor";
};

export const roleFromPartner = (partner?: any, fallback?: string | null): PartnerRoleKey => {
    const explicitRole = typeof partner?.role === "string" ? partner.role : partner?.role?.name;
    if (explicitRole) return normalizePartnerRole(explicitRole);

    const roleId = typeof partner?.roleId === "string" ? partner.roleId : partner?.roleId?._id;
    const match = Object.entries(PARTNER_ROLE_IDS).find(([, id]) => id === roleId);
    return match ? match[0] as PartnerRoleKey : normalizePartnerRole(fallback);
};

export const missingRequiredDocuments = (partner: any, role?: string | null) => {
    const partnerRole = roleFromPartner(partner, role);
    const uploadedTypes = new Set(
        (partner?.documents || [])
            .filter((doc: any) => doc?.type && doc?.url)
            .map((doc: any) => String(doc.type).trim())
    );

    return REQUIRED_DOCUMENTS[partnerRole].filter((docType) => !uploadedTypes.has(docType));
};

export const needsKycUpload = (partner: any, role?: string | null) => {
    if (!partner || partner.isRegistered === false) return true;
    return missingRequiredDocuments(partner, role).length > 0;
};
