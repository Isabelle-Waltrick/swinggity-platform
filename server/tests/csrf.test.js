//  The code in this file were created with help of AI (Copilot)

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    clearCsrfSecretCookie,
    createCsrfToken,
    ensureCsrfSecretCookie,
    verifyCsrfToken,
} from '../utils/csrf.js';
import { csrfProtection } from '../middleware/csrfProtection.js';

const createMockRes = () => ({
    cookies: [],
    clearedCookies: [],
    cookie(name, value, options) {
        this.cookies.push({ name, value, options });
    },
    clearCookie(name, options) {
        this.clearedCookies.push({ name, options });
    },
    statusCode: null,
    payload: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.payload = body;
        return this;
    },
});

const createMockReq = ({ method = 'GET', origin = '', referer = '', cookies = {}, csrfToken = '' } = {}) => ({
    method,
    cookies,
    get(headerName) {
        const normalizedHeaderName = String(headerName || '').toLowerCase();
        if (normalizedHeaderName === 'origin') {
            return origin;
        }
        if (normalizedHeaderName === 'referer') {
            return referer;
        }
        if (normalizedHeaderName === 'x-csrf-token') {
            return csrfToken;
        }
        return '';
    },
});

test('ensureCsrfSecretCookie reuses an existing secret', () => {
    const res = createMockRes();
    const req = { cookies: { csrf_secret: 'existing-secret' } };

    const secret = ensureCsrfSecretCookie(req, res);

    assert.equal(secret, 'existing-secret');
    assert.equal(res.cookies.length, 0);
});

test('ensureCsrfSecretCookie creates a cookie when missing', () => {
    const res = createMockRes();
    const req = { cookies: {} };

    const secret = ensureCsrfSecretCookie(req, res);

    assert.equal(typeof secret, 'string');
    assert.equal(secret.length > 0, true);
    assert.equal(res.cookies.length, 1);
    assert.equal(res.cookies[0].name, 'csrf_secret');
    assert.equal(res.cookies[0].value, secret);
});

test('clearCsrfSecretCookie clears the csrf secret cookie', () => {
    const res = createMockRes();

    clearCsrfSecretCookie(res);

    assert.equal(res.clearedCookies.length, 1);
    assert.equal(res.clearedCookies[0].name, 'csrf_secret');
});

test('createCsrfToken and verifyCsrfToken round-trip', () => {
    const secret = 'test-secret';
    const originalNow = Date.now;
    Date.now = () => 1_700_000_000_000;

    try {
        const token = createCsrfToken(secret);
        assert.equal(verifyCsrfToken(token, secret), true);
        assert.equal(verifyCsrfToken(token, 'wrong-secret'), false);
    } finally {
        Date.now = originalNow;
    }
});

test('verifyCsrfToken rejects expired tokens', () => {
    const secret = 'test-secret';
    const originalNow = Date.now;
    Date.now = () => 1_700_000_000_000;

    try {
        const token = createCsrfToken(secret);
        Date.now = () => 1_700_000_000_000 + (2 * 60 * 60 * 1000) + 1;

        assert.equal(verifyCsrfToken(token, secret), false);
    } finally {
        Date.now = originalNow;
    }
});

test('csrfProtection allows safe methods', () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    let nextCalled = false;

    csrfProtection(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
});

test('csrfProtection rejects invalid origin on unsafe methods', () => {
    const req = createMockReq({
        method: 'POST',
        origin: 'https://evil.example',
        cookies: { csrf_secret: 'test-secret' },
        csrfToken: 'token',
    });
    const res = createMockRes();
    let nextCalled = false;

    csrfProtection(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.success, false);
});

test('csrfProtection accepts valid origin and token', () => {
    const secret = 'test-secret';
    const originalNow = Date.now;
    Date.now = () => 1_700_000_000_000;

    try {
        const token = createCsrfToken(secret);
        const req = createMockReq({
            method: 'POST',
            origin: 'http://localhost:5173',
            cookies: { csrf_secret: secret },
            csrfToken: token,
        });
        const res = createMockRes();
        let nextCalled = false;

        csrfProtection(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(res.statusCode, null);
    } finally {
        Date.now = originalNow;
    }
});
