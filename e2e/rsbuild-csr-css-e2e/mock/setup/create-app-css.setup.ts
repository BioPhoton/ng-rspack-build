import { setupE2eApp } from '../utils';
import { join } from 'node:path';
const path = require('path');

export default async function globalSetup() {
  const fixtureProjectName = 'rsbuild-csr-css';
  await setupE2eApp(fixtureProjectName, join(__dirname, '../fixtures'));
}
