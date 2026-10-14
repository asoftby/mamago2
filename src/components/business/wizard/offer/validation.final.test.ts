import assert from "node:assert/strict";
import { getDefaultFormData } from "./defaults";

// The public-access barrel reaches a client phone-input stylesheet; node tests
// only exercise the synchronous validation functions, not UI styles.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require.extensions[".css"] = () => {};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateForSubmit } = require("./validation") as typeof import("./validation");

const data = getDefaultFormData("place-id");
data.productType = "PLACE_VISIT";
data.offerWizardType = "REGULAR";
data.title = "Входной билет";
data.shortDescription = "Интересное семейное предложение";
data.description = "Подробное описание предложения для семьи и детей";
data.coverImage = "https://example.by/cover.jpg";
data.singlePrice = "30";
data.categoryIds = ["cat-id"];
data.contactSource = "place";
data.schedule.bookingMethod = "NONE";

assert.deepEqual(validateForSubmit(data, "v2").errors, []);
assert.ok(validateForSubmit(data, "v1").errors.includes("Выберите тип действия"));
data.schedule.bookingMethod = null;
assert.ok(validateForSubmit(data, "v2").errors.includes("Способ записи"));
data.schedule.bookingMethod = "EXTERNAL";
assert.ok(validateForSubmit(data, "v2").errors.includes("Ссылка для записи"));
data.schedule.externalUrl = "https://tickets.example.by/a";
assert.deepEqual(validateForSubmit(data, "v2").errors, []);

console.log("offer final validation tests passed");
