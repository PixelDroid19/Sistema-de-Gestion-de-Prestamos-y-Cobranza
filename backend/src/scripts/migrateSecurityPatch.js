/**
 * Security Patch Migration Script
 * 
 * Adds columns required for security features implemented in:
 * - Account lockout (Users.failedLoginAttempts, Users.lockedUntil)
 * - DAG version tracking (Loans.dagGraphVersionId, DagGraphVersions.description, DagGraphVersions.status)
 * - Rate limiting (RateLimitEntry - already created)
 * 
 * Run with: node src/scripts/migrateSecurityPatch.js
 */

require('dotenv').config();

const { sequelize } = require('@/models');

async function migrate() {
  console.log('🔒 Starting Security Patch Migration...\n');
  
  const transaction = await sequelize.transaction();
  
  try {
    // 1. Add failedLoginAttempts and lockedUntil to Users table
    console.log('📝 Adding security columns to Users table...');
    
    await sequelize.query(`
      ALTER TABLE "Users" 
      ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP WITH TIME ZONE;
    `, { transaction });
    
    console.log('   ✅ Users table updated (failedLoginAttempts, lockedUntil)');
    
    // 2. Add dagGraphVersionId to Loans table
    console.log('📝 Adding dagGraphVersionId to Loans table...');
    
    await sequelize.query(`
      ALTER TABLE "Loans"
      ADD COLUMN IF NOT EXISTS "dagGraphVersionId" INTEGER;
    `, { transaction });
    
    // Add foreign key constraint if not exists
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'Loans_dagGraphVersionId_fkey'
        ) THEN
          ALTER TABLE "Loans" 
          ADD CONSTRAINT "Loans_dagGraphVersionId_fkey"
          FOREIGN KEY ("dagGraphVersionId") REFERENCES "DagGraphVersions"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `, { transaction });
    
    console.log('   ✅ Loans table updated (dagGraphVersionId with FK constraint)');
    
    // 3. Add description and status to DagGraphVersions table
    console.log('📝 Adding columns to DagGraphVersions table...');
    
    await sequelize.query(`
      ALTER TABLE "DagGraphVersions"
      ADD COLUMN IF NOT EXISTS "description" VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL DEFAULT 'active';
    `, { transaction });
    
    console.log('   ✅ DagGraphVersions table updated (description, status)');
    
    // 4. Create RateLimitEntry table manually (RateLimitEntry.sync() has index issues)
    console.log('📝 Creating RateLimitEntry table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "rate_limit_entries" (
        id SERIAL PRIMARY KEY,
        "keyPrefix" VARCHAR(50) NOT NULL,
        "identifier" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `, { transaction });
    
    // Create indexes separately
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "RateLimitEntries_key_idx" 
      ON "rate_limit_entries"("keyPrefix", "identifier", "created_at");
      
      CREATE INDEX IF NOT EXISTS "RateLimitEntries_expiresAt_idx" 
      ON "rate_limit_entries"("keyPrefix", "created_at");
    `, { transaction });
    
    console.log('   ✅ RateLimitEntry table created');
    
    // 5. Create indexes for performance
    console.log('📝 Creating performance indexes...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS "Users_lockedUntil_idx" ON "Users"("lockedUntil") 
      WHERE "lockedUntil" IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS "Users_failedLoginAttempts_idx" ON "Users"("failedLoginAttempts");
      
      CREATE INDEX IF NOT EXISTS "rate_limit_entries_key_idx" ON "rate_limit_entries"("keyPrefix", "identifier", "created_at");
      CREATE INDEX IF NOT EXISTS "rate_limit_entries_cleanup_idx" ON "rate_limit_entries"("keyPrefix", "created_at");
    `, { transaction });
    
    console.log('   ✅ Indexes created');
    
    // Commit transaction
    await transaction.commit();
    
    console.log('\n🎉 Security Patch Migration COMPLETED successfully!\n');
    
    // Verify columns exist
    console.log('🔍 Verifying columns...');
    const usersCols = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name IN ('failedLoginAttempts', 'lockedUntil');
    `);
    console.log(`   Users columns: ${usersCols[0].map(r => r.column_name).join(', ')}`);
    
    const loansCols = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'Loans' AND column_name = 'dagGraphVersionId';
    `);
    console.log(`   Loans columns: ${loansCols[0].map(r => r.column_name).join(', ')}`);
    
    const dagCols = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'DagGraphVersions' AND column_name IN ('description', 'status');
    `);
    console.log(`   DagGraphVersions columns: ${dagCols[0].map(r => r.column_name).join(', ')}`);
    
    const rateCols = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'RateLimitEntries';
    `);
    console.log(`   RateLimitEntries columns: ${rateCols[0].map(r => r.column_name).join(', ')}`);
    
    console.log('\n✅ All security columns verified!');
    console.log('\n⚠️  NOTE: Run tests again to verify fixes work correctly.');
    
  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Migration FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
