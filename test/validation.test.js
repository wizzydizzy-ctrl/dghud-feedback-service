import test from "node:test";
import assert from "node:assert/strict";
import {validateSubmission} from "../src/index.js";

test("accepts a bounded anonymous diagnostic", () => {
  const result = validateSubmission({edition:"player",kind:"debug",install_id:"01234567-89ab-cdef-0123-456789abcdef",version:"0.2.137",message:"Map failed",diagnostic:"safe data"});
  assert.equal(result.error, undefined); assert.equal(result.value.edition, "player");
});

test("rejects invalid identity, edition, empty bodies, and honeypot", () => {
  assert.ok(validateSubmission({}).error);
  assert.ok(validateSubmission({edition:"other",kind:"debug",install_id:"01234567-89ab-cdef-0123-456789abcdef",message:"x"}).error);
  assert.ok(validateSubmission({edition:"staff",kind:"debug",install_id:"bad",message:"x"}).error);
  assert.ok(validateSubmission({edition:"staff",kind:"debug",install_id:"01234567-89ab-cdef-0123-456789abcdef",website:"spam",message:"x"}).error);
});
