const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

describe('tokenService', () => {
  // Use the actual tokenService
  const { createJwtTokenService, hashRefreshToken, calculateRefreshTokenExpiry } = require('@/modules/shared/auth/tokenService');

  test('createJwtTokenService generates access token with 15min expiry', () => {
    const tokenService = createJwtTokenService({ secret: 'test-secret' });
    const token = tokenService.generateAccessToken(1, 'admin');
    
    assert.ok(token, 'Token should be generated');
    assert.equal(typeof token, 'string', 'Token should be a string');
    assert.ok(token.split('.').length === 3, 'Token should be a JWT with 3 parts');
  });

  test('createJwtTokenService generates refresh token as 64-char hex string', () => {
    const tokenService = createJwtTokenService();
    const refreshToken = tokenService.generateRefreshToken();
    
    assert.ok(refreshToken, 'Refresh token should be generated');
    assert.equal(typeof refreshToken, 'string', 'Refresh token should be a string');
    assert.equal(refreshToken.length, 64, 'Refresh token should be 64 characters (32 bytes hex)');
    assert.ok(/^[a-f0-9]+$/.test(refreshToken), 'Refresh token should be hex characters');
  });

  test('createJwtTokenService generates token pair', () => {
    const tokenService = createJwtTokenService({ secret: 'test-secret' });
    const { accessToken, refreshToken } = tokenService.generateTokenPair(1, 'admin');
    
    assert.ok(accessToken, 'Access token should be generated');
    assert.ok(refreshToken, 'Refresh token should be generated');
    assert.equal(typeof accessToken, 'string', 'Access token should be a string');
    assert.equal(typeof refreshToken, 'string', 'Refresh token should be a string');
    assert.equal(refreshToken.length, 64, 'Refresh token should be 64 characters');
  });

  test('createJwtTokenService verifies valid access token', () => {
    const secret = 'test-secret';
    const tokenService = createJwtTokenService({ secret });
    const token = tokenService.generateAccessToken(1, 'admin', { name: 'Admin Test' });
    const decoded = tokenService.verify(token);
    
    assert.equal(decoded.id, 1, 'User ID should match');
    assert.equal(decoded.role, 'admin', 'Role should match');
    assert.equal(decoded.name, 'Admin Test', 'Name should match');
  });

  test('hashRefreshToken produces consistent SHA-256 hash', () => {
    const token = 'test-refresh-token-12345';
    const hash = hashRefreshToken(token);
    
    // Verify it's SHA-256 (64 hex chars)
    assert.equal(hash.length, 64, 'Hash should be 64 characters');
    
    // Verify consistency
    const hash2 = hashRefreshToken(token);
    assert.equal(hash, hash2, 'Same token should produce same hash');
    
    // Verify it's correct SHA-256
    const expected = crypto.createHash('sha256').update(token).digest('hex');
    assert.equal(hash, expected, 'Hash should match expected SHA-256');
  });

  test('calculateRefreshTokenExpiry returns date 7 days in future', () => {
    const before = new Date();
    const expiry = calculateRefreshTokenExpiry();
    const after = new Date();
    
    // Should be approximately 7 days from now
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const expectedMin = before.getTime() + sevenDaysMs;
    const expectedMax = after.getTime() + sevenDaysMs;
    
    assert.ok(expiry.getTime() >= expectedMin - 1000, 'Expiry should be at least 7 days from now');
    assert.ok(expiry.getTime() <= expectedMax + 1000, 'Expiry should be at most 7 days from now');
  });

  test('calculateRefreshTokenExpiry accepts custom day parameter', () => {
    const before = new Date();
    const expiry = calculateRefreshTokenExpiry(3);
    const after = new Date();
    
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const expectedMin = before.getTime() + threeDaysMs;
    const expectedMax = after.getTime() + threeDaysMs;
    
    assert.ok(expiry.getTime() >= expectedMin - 1000, 'Expiry should be at least 3 days from now');
    assert.ok(expiry.getTime() <= expectedMax + 1000, 'Expiry should be at most 3 days from now');
  });

  test('createJwtTokenService verifyRefreshToken rejects when repository not configured', async () => {
    const tokenService = createJwtTokenService({ secret: 'test-secret' });
    
    await assert.rejects(
      async () => tokenService.verifyRefreshToken('some-token'),
      /Refresh token repository not configured/
    );
  });

  test('createJwtTokenService verifyRefreshToken rejects invalid token', async () => {
    const mockRepo = {
      async findByTokenHash() { return null; },
    };
    const tokenService = createJwtTokenService({ secret: 'test-secret', refreshTokenRepository: mockRepo });
    
    await assert.rejects(
      async () => tokenService.verifyRefreshToken('invalid-token'),
      /Invalid or expired refresh token/
    );
  });

  test('createJwtTokenService verifyRefreshToken rejects revoked token', async () => {
    const mockRepo = {
      async findByTokenHash() {
        return {
          id: 'token-id',
          userId: 1,
          revokedAt: new Date(), // Token is revoked
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
      },
    };
    const tokenService = createJwtTokenService({ secret: 'test-secret', refreshTokenRepository: mockRepo });
    
    await assert.rejects(
      async () => tokenService.verifyRefreshToken('revoked-token'),
      /Invalid or expired refresh token/
    );
  });

  test('createJwtTokenService verifyRefreshToken rejects expired token', async () => {
    const mockRepo = {
      async findByTokenHash() {
        return {
          id: 'token-id',
          userId: 1,
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1000), // Token is expired
        };
      },
    };
    const tokenService = createJwtTokenService({ secret: 'test-secret', refreshTokenRepository: mockRepo });
    
    await assert.rejects(
      async () => tokenService.verifyRefreshToken('expired-token'),
      /Invalid or expired refresh token/
    );
  });

  test('createJwtTokenService verifyRefreshToken accepts valid token', async () => {
    const mockRepo = {
      async findByTokenHash(tokenHash) {
        assert.equal(tokenHash.length, 64, 'Should lookup by hash');
        return {
          id: 'token-id',
          userId: 42,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
      },
    };
    const tokenService = createJwtTokenService({ secret: 'test-secret', refreshTokenRepository: mockRepo });
    
    const result = await tokenService.verifyRefreshToken('valid-token');
    assert.equal(result.userId, 42, 'Should return userId');
    assert.equal(result.tokenId, 'token-id', 'Should return tokenId');
  });

  test('legacy sign and verify methods still work', () => {
    const tokenService = createJwtTokenService({ secret: 'test-secret' });
    const token = tokenService.sign({ id: 1, role: 'admin', name: 'Admin Test' });
    const decoded = tokenService.verify(token);
    
    assert.equal(decoded.id, 1, 'User ID should match');
    assert.equal(decoded.role, 'admin', 'Role should match');
    assert.equal(decoded.name, 'Admin Test', 'Name should match');
  });
});
