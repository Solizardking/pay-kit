#!/usr/bin/env node
// Regression: playground @x402/core and @x402/svm `file:` pins must name
// tarballs that actually exist under typescript/.x402-vendor/. A stale pin
// (e.g. x402-core-2.16.0.tgz after the vendor dir moved to 2.23.0) makes
// `pnpm install` fail with ENOENT before the API can start.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const PLAYGROUND = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR = resolve(PLAYGROUND, '../typescript/.x402-vendor')
const STALE = /x402-(?:core|svm)-2\.16\.0/

function vendorTarballNames(text) {
  return [...new Set(text.match(/x402-(?:core|svm)-[^\s'"]+\.tgz/g) ?? [])]
}

function assertExistingVendorTarball(name, label) {
  assert.match(name, /^x402-(?:core|svm)-\d+\.\d+\.\d+\.tgz$/, `${label}: unexpected tarball name ${name}`)
  assert.doesNotMatch(name, STALE, `${label}: stale 2.16.0 pin ${name}`)
  const abs = join(VENDOR, name)
  assert.ok(existsSync(abs), `${label}: missing vendor tarball ${abs}`)
}

test('vendor dir contains packed @x402 tarballs', () => {
  const names = readdirSync(VENDOR).filter((n) => n.endsWith('.tgz'))
  assert.ok(names.includes('x402-core-2.23.0.tgz'), `vendor missing x402-core-2.23.0.tgz, have: ${names.join(', ')}`)
  assert.ok(names.includes('x402-svm-2.23.0.tgz'), `vendor missing x402-svm-2.23.0.tgz, have: ${names.join(', ')}`)
})

test('playground/app/package.json file: pins resolve to existing vendor tarballs', () => {
  const pkgPath = join(PLAYGROUND, 'app/package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const appDir = join(PLAYGROUND, 'app')
  for (const name of ['@x402/core', '@x402/svm']) {
    const spec = pkg.dependencies[name]
    assert.equal(typeof spec, 'string', `${name} missing from app dependencies`)
    assert.ok(spec.startsWith('file:'), `${name} must be a file: pin, got ${spec}`)
    const abs = resolve(appDir, spec.slice('file:'.length))
    assert.ok(abs.startsWith(VENDOR + '/'), `${name}: ${spec} must resolve under ${VENDOR}`)
    assert.ok(existsSync(abs), `${name}: missing vendor tarball ${abs}`)
    assertExistingVendorTarball(abs.slice(VENDOR.length + 1), `app ${name}`)
  }
})

test('playground workspace overrides resolve to existing vendor tarballs', () => {
  const yaml = readFileSync(join(PLAYGROUND, 'pnpm-workspace.yaml'), 'utf8')
  const names = vendorTarballNames(yaml)
  assert.ok(names.includes('x402-core-2.23.0.tgz'), `workspace missing core pin: ${names.join(', ')}`)
  assert.ok(names.includes('x402-svm-2.23.0.tgz'), `workspace missing svm pin: ${names.join(', ')}`)
  for (const name of names) {
    assertExistingVendorTarball(name, 'workspace override')
  }
})

test('playground lockfile does not name missing 2.16.0 vendor tarballs', () => {
  const lock = readFileSync(join(PLAYGROUND, 'pnpm-lock.yaml'), 'utf8')
  assert.doesNotMatch(lock, STALE, 'pnpm-lock.yaml still names a 2.16.0 vendor tarball')
  const names = vendorTarballNames(lock)
  assert.ok(names.length > 0, 'pnpm-lock.yaml has no @x402 vendor tarball names')
  for (const name of names) {
    assertExistingVendorTarball(name, 'lockfile')
  }
})

test('playground-api resolves shipped createPayKit from built @solana/pay-kit', async () => {
  const dist = join(PLAYGROUND, '../typescript/examples/playground-api/node_modules/@solana/pay-kit/dist/index.js')
  assert.ok(existsSync(dist), `playground-api missing pay-kit dist at ${dist}`)
  const mod = await import(pathToFileURL(dist).href)
  assert.equal(typeof mod.createPayKit, 'function')
})
