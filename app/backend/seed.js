import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

async function main() {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL)
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail) throw new Error('ADMIN_EMAIL is required in .env')
  if (!adminPassword || !adminPassword.trim()) throw new Error('ADMIN_PASSWORD is required in .env')

  const hashed = await argon2.hash(adminPassword)

  await prisma.teacher.upsert({
    where: { email: adminEmail },
    update: { password: hashed, admin: true },
    create: { email: adminEmail, password: hashed, admin: true }
  })

  console.log('Admin user created:', adminEmail)
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
