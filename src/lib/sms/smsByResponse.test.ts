import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildSmsByRequestBody, parseSmsByResponse, SmsByDeliveryError } from "./smsByResponse";

test("sms.by NEW with message id is accepted", () => {
  const result = parseSmsByResponse(200, JSON.stringify({ sms_id: "12345", status: "NEW" }));
  assert.equal(result.sms_id, "12345");
});

test("sms.by accepts legacy success with message_id", () => {
  const result = parseSmsByResponse(200, JSON.stringify({ message_id: "12345", status: "success" }));
  assert.equal(result.message_id, "12345");
});

test("HTTP 200 with provider error is not treated as sent", () => {
  assert.throws(
    () => parseSmsByResponse(200, JSON.stringify({ status: "error", message: "balance error" })),
    (error: unknown) =>
      error instanceof SmsByDeliveryError && error.reason === "PROVIDER_REJECTED",
  );
});

test("HTTP 200 with no delivery id is not treated as sent", () => {
  assert.throws(
    () => parseSmsByResponse(200, JSON.stringify({ status: "NEW" })),
    (error: unknown) =>
      error instanceof SmsByDeliveryError && error.reason === "INVALID_RESPONSE",
  );
});

test("HTTP 4xx is rejected without forwarding provider body", () => {
  const secret = "secret-provider-body";
  assert.throws(
    () => parseSmsByResponse(400, JSON.stringify({ error: secret })),
    (error: unknown) =>
      error instanceof SmsByDeliveryError &&
      error.reason === "HTTP_ERROR" &&
      !error.message.includes(secret),
  );
});

test("invalid provider response is not treated as sent", () => {
  assert.throws(
    () => parseSmsByResponse(200, "<html>not-json</html>"),
    (error: unknown) =>
      error instanceof SmsByDeliveryError && error.reason === "INVALID_RESPONSE",
  );
});

test("sms.by request has exactly the three fields of the working integration", () => {
  const body = buildSmsByRequestBody({
    token: "test-secret",
    phoneDigits: "375291234567",
    message: "Код: 1234",
  });
  assert.deepEqual([...body.keys()], ["token", "phone", "message"]);
  assert.equal(body.has("alphaname_id"), false);
  assert.equal(body.has("sender"), false);
});
