import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

async function main() {
  try {
    console.log('Adding nom and prenom columns to Student table...')
    
    // Check if columns already exist
    const result = await prisma.$queryRawUnsafe(
      `PRAGMA table_info(Student)`
    )
    
    const hasNom = result.some(col => col.name === 'nom')
    const hasPrenom = result.some(col => col.name === 'prenom')
    
    if (!hasNom) {
      await prisma.$executeRawUnsafe(`ALTER TABLE Student ADD COLUMN nom TEXT`)
      console.log('✓ Added nom column')
    } else {
      console.log('✓ nom column already exists')
    }
    
    if (!hasPrenom) {
      await prisma.$executeRawUnsafe(`ALTER TABLE Student ADD COLUMN prenom TEXT`)
      console.log('✓ Added prenom column')
    } else {
      console.log('✓ prenom column already exists')
    }
    
    console.log('Migration complete!')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
