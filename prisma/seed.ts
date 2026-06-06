import { PrismaClient, SystemRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding HairOS platform...')

  // Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'drfact' },
    update: {},
    create: {
      name: 'DrFACT Healthcare',
      slug: 'drfact',
      country: 'IN',
      timezone: 'Asia/Kolkata',
    },
  })
  console.log(`Organization: ${org.name} (${org.id})`)

  // Clinic
  const clinic = await prisma.clinic.upsert({
    where: { slug: 'drfact-mumbai' },
    update: {},
    create: {
      organizationId: org.id,
      name: 'DrFACT Mumbai',
      slug: 'drfact-mumbai',
      region: 'Mumbai',
      language: 'en',
      timezone: 'Asia/Kolkata',
    },
  })
  console.log(`Clinic: ${clinic.name} (${clinic.id})`)

  // IMPORTANT: Doctor requires a real Supabase auth.users.id
  // Replace this UUID with the actual Supabase user ID for the doctor.
  // Create the user in Supabase Auth first, then copy their UUID here.
  const DOCTOR_SUPABASE_USER_ID = process.env.SEED_DOCTOR_SUPABASE_ID ?? 'REPLACE_WITH_REAL_SUPABASE_USER_ID'

  if (DOCTOR_SUPABASE_USER_ID !== 'REPLACE_WITH_REAL_SUPABASE_USER_ID') {
    const doctor = await prisma.doctor.upsert({
      where: { supabaseUserId: DOCTOR_SUPABASE_USER_ID },
      update: {},
      create: {
        supabaseUserId: DOCTOR_SUPABASE_USER_ID,
        clinicId: clinic.id,
        name: 'Dr. Seed Doctor',
        email: 'doctor@drfact.com',
      },
    })
    console.log(`Doctor: ${doctor.name} (${doctor.id})`)
  } else {
    console.log('Skipping Doctor seed — set SEED_DOCTOR_SUPABASE_ID env var with a real Supabase user ID')
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
