import crypto from 'crypto';

class DataMaskerService {
  /**
   * Masks email address into a deterministic, anonymous identifier.
   * e.g. "sarah.connor@acme.corp" -> "usr_9b3e1f@masked.internal"
   */
  maskEmail(email) {
    if (!email || typeof email !== 'string') return 'user@masked.internal';
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex').substring(0, 8);
    return `usr_${hash}@masked.internal`;
  }

  /**
   * Masks phone numbers preserving country code format.
   */
  maskPhone(phone) {
    if (!phone) return '+1-555-0199';
    return String(phone).replace(/\d(?=\d{2})/g, '*');
  }

  /**
   * Masks credit cards: keeps only last 4 digits.
   */
  maskCreditCard(cc) {
    if (!cc) return '4111-****-****-0000';
    const clean = String(cc).replace(/\D/g, '');
    const last4 = clean.slice(-4) || '1234';
    return `****-****-****-${last4}`;
  }

  /**
   * Generates a clean, sanitized test seed dataset for the ephemeral database.
   * Contains safe mock users, organizations, transactions, and project records.
   */
  generateSanitizedSeedData(count = 10) {
    const roles = ['admin', 'developer', 'viewer', 'billing'];
    const users = [];

    for (let i = 1; i <= count; i++) {
      const rawEmail = `engineer_${i}@production-corp.internal`;
      users.push({
        id: i,
        username: `dev_user_${i}`,
        email: this.maskEmail(rawEmail),
        role: roles[i % roles.length],
        phone: this.maskPhone(`+1555010${i}`),
        maskedCreditCard: this.maskCreditCard(`411122223333444${i % 10}`),
        balanceCents: (i * 12500) % 500000,
        isVerified: true,
        passwordHash: '$2a$10$WqB8F5QZ9pL1nZ7rK5uQveDEVTESTHASHNOTFORPROD',
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }

    const projects = [
      { id: 1, name: 'Core API Gateway', status: 'active', ownerId: 1 },
      { id: 2, name: 'Billing & Invoicing', status: 'active', ownerId: 2 },
      { id: 3, name: 'Auth & Single Sign-On', status: 'active', ownerId: 1 },
      { id: 4, name: 'Realtime WebSocket Mesh', status: 'staging', ownerId: 3 },
    ];

    const auditLogs = [
      { id: 1, event: 'schema.migrated', actor: 'usr_migration_bot', timestamp: new Date().toISOString() },
      { id: 2, event: 'db.branch_created', actor: 'codesync_system', timestamp: new Date().toISOString() },
    ];

    return {
      users,
      projects,
      auditLogs,
      generatedAt: new Date().toISOString(),
      piiSanitized: true,
    };
  }

  /**
   * Sanitizes arbitrary JSON or SQL seed objects by identifying and masking common PII fields.
   */
  sanitizeRecord(record) {
    if (!record || typeof record !== 'object') return record;
    const sanitized = { ...record };

    for (const [key, val] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (typeof val === 'string') {
        if (lowerKey.includes('email')) {
          sanitized[key] = this.maskEmail(val);
        } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
          sanitized[key] = this.maskPhone(val);
        } else if (lowerKey.includes('card') || lowerKey.includes('cc') || lowerKey.includes('pan')) {
          sanitized[key] = this.maskCreditCard(val);
        } else if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('key')) {
          sanitized[key] = 'DEV_MASKED_SECRET_SAFE_FOR_TESTING';
        }
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = this.sanitizeRecord(val);
      }
    }

    return sanitized;
  }
}

export default new DataMaskerService();
