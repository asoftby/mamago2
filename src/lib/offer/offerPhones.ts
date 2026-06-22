import { getNormalizedPhones, normalizePhoneFields, type NormalizedPhone } from "@/lib/phones/normalizePhones";

export interface OfferPhoneFields {
  contactPhone?: string | null;
  contactPhoneLabel?: string | null;
  contactPhone2?: string | null;
  contactPhone2Label?: string | null;
  contactPhone3?: string | null;
  contactPhone3Label?: string | null;
}

export function normalizeOfferPhoneFields(input: OfferPhoneFields): Required<OfferPhoneFields> {
  const normalized = normalizePhoneFields({
    phone: input.contactPhone,
    phoneLabel: input.contactPhoneLabel,
    phone2: input.contactPhone2,
    phone2Label: input.contactPhone2Label,
    phone3: input.contactPhone3,
    phone3Label: input.contactPhone3Label,
  });

  return {
    contactPhone: normalized.phone,
    contactPhoneLabel: normalized.phoneLabel,
    contactPhone2: normalized.phone2,
    contactPhone2Label: normalized.phone2Label,
    contactPhone3: normalized.phone3,
    contactPhone3Label: normalized.phone3Label,
  };
}

export function getNormalizedOfferPhones(input: OfferPhoneFields): NormalizedPhone[] {
  return getNormalizedPhones({
    phone: input.contactPhone,
    phoneLabel: input.contactPhoneLabel,
    phone2: input.contactPhone2,
    phone2Label: input.contactPhone2Label,
    phone3: input.contactPhone3,
    phone3Label: input.contactPhone3Label,
  });
}
