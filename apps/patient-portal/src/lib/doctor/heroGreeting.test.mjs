import { test } from "node:test";
import assert from "node:assert/strict";
import { doctorHeroName } from "./heroGreeting.ts";

// Regression coverage for the P0 dashboard greeting fix.
// CommandBand renders `${doctorHeroName(name)}.`, so the rendered greeting is
// each expected value below followed by a single full stop.

test("Mrs. Meha Mhatre -> Dr. Meha (the Tressze P0; never 'Dr Mrs..')", () => {
  assert.equal(doctorHeroName("Mrs. Meha Mhatre"), "Dr. Meha");
  assert.equal(`${doctorHeroName("Mrs. Meha Mhatre")}.`, "Dr. Meha.");
});

test("Dr Avinash Agarwal -> Dr Avinash (existing greeting preserved exactly)", () => {
  assert.equal(doctorHeroName("Dr Avinash Agarwal"), "Dr Avinash");
  assert.equal(`${doctorHeroName("Dr Avinash Agarwal")}.`, "Dr Avinash.");
});

test("a name with no title -> Dr. <First>", () => {
  assert.equal(doctorHeroName("Meha Mhatre"), "Dr. Meha");
});

test("other honorifics and period variants are normalised", () => {
  assert.equal(doctorHeroName("Mr. John Doe"), "Dr. John");
  assert.equal(doctorHeroName("Ms Riya Shah"), "Dr. Riya");
  assert.equal(doctorHeroName("Miss Anita Rao"), "Dr. Anita");
  assert.equal(doctorHeroName("Dr. Neha Kapoor"), "Dr. Neha");
});

test("missing or title-only names fall back to 'Doctor'", () => {
  assert.equal(doctorHeroName(null), "Doctor");
  assert.equal(doctorHeroName(undefined), "Doctor");
  assert.equal(doctorHeroName("   "), "Doctor");
  assert.equal(doctorHeroName("Dr."), "Doctor");
});

test("a real name beginning with 'Dr' is not mistaken for a title", () => {
  assert.equal(doctorHeroName("Drew Barrymore"), "Dr. Drew");
});
