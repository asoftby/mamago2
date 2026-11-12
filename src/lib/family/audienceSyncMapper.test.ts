import assert from 'node:assert/strict';
import test from 'node:test';
import { findAgeGroupsByYears } from './audienceSyncMapper';

test('age nine selects both neighboring bands', () => {
  assert.deepEqual(findAgeGroupsByYears(9), ['7-9', '9-12']);
});
test('shared boundaries include both bands', () => {
  assert.deepEqual(findAgeGroupsByYears(12), ['9-12', '12-14']);
  assert.deepEqual(findAgeGroupsByYears(18), ['16-18', '18+']);
});
test('middle age selects just one band', () => {
  assert.deepEqual(findAgeGroupsByYears(10), ['9-12']);
});
