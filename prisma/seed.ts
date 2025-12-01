import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log('Admin user already exists');
    return;
  }

  // Create admin user
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: {
      email: process.env.ADMIN_EMAIL || 'admin@pixelpim.com',
      fullname: 'System Administrator',
      password: hashedPassword,
      role: Role.ADMIN,
      ownerId: null,
    },
  });

  console.log('Admin user created successfully:');
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log('⚠️  IMPORTANT: Please change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
