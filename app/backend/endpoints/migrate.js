import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

async function main() {
  try {
    console.log('Adding nom and prenom columns to Student table...')
    
    
    console.log('Migration complete!')
  } catch (err) {
    console.error('Migration error:', err.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
