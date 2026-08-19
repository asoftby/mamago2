import assert from "node:assert/strict";

import {
  getServicesProgramsOfferMapping,
  SERVICES_PROGRAMS_TO_OFFER_MAPPINGS,
  WORDPRESS_PROGRAMS_POST_TYPE,
  WORDPRESS_SERVICES_POST_TYPE,
} from "./offerMapping";

assert.equal(SERVICES_PROGRAMS_TO_OFFER_MAPPINGS.length, 2);

const servicesMapping = getServicesProgramsOfferMapping(WORDPRESS_SERVICES_POST_TYPE);
assert.equal(servicesMapping?.sourcePostType, "services");
assert.equal(servicesMapping?.targetType, "OFFER");
assert.equal(servicesMapping?.mediaScope, "OFFER_SERVICES");
assert.equal(servicesMapping?.targetRole, "wordpress-service-offer");

const programsMapping = getServicesProgramsOfferMapping(WORDPRESS_PROGRAMS_POST_TYPE);
assert.equal(programsMapping?.sourcePostType, "hb-programs");
assert.equal(programsMapping?.targetType, "OFFER");
assert.equal(programsMapping?.mediaScope, "OFFER_PROGRAMS");
assert.equal(programsMapping?.targetRole, "wordpress-program-offer");

assert.equal(getServicesProgramsOfferMapping("post"), null);

console.log("migration offer mapping tests: OK");
