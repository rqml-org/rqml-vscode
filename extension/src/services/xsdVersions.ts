// XSD version resolution utilities

import * as fs from 'fs';
import * as path from 'path';

const XSD_FILENAME_PATTERN = /^rqml-(\d+\.\d+\.\d+)\.xsd$/;

/**
 * Scan resources/xsd/ and return all available RQML XSD versions, sorted ascending.
 */
export function getAvailableXsdVersions(extensionPath: string): string[] {
  const xsdDir = path.join(extensionPath, 'resources', 'xsd');
  try {
    return fs.readdirSync(xsdDir)
      .map(f => XSD_FILENAME_PATTERN.exec(f)?.[1])
      .filter((v): v is string => v !== undefined)
      .sort(compareSemver);
  } catch {
    return [];
  }
}

/**
 * Return the latest available XSD version, or undefined if none found.
 */
export function getLatestXsdVersion(extensionPath: string): string | undefined {
  const versions = getAvailableXsdVersions(extensionPath);
  return versions.length > 0 ? versions[versions.length - 1] : undefined;
}

/**
 * Build the full path to a version-specific XSD file.
 */
export function getXsdPath(extensionPath: string, version: string): string {
  return path.join(extensionPath, 'resources', 'xsd', `rqml-${version}.xsd`);
}

/**
 * Check whether an XSD file exists for the given version.
 */
export function isXsdAvailable(extensionPath: string, version: string): boolean {
  try {
    fs.accessSync(getXsdPath(extensionPath, version));
    return true;
  } catch {
    return false;
  }
}

/** Simple semver comparison for sorting. */
function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}
