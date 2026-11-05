// Run this script ONCE to create the admin account:
// node prisma/createAdmin.js

import "../env.js";
import bcrypt from "bcrypt";
import prisma from "./client.js";

const ADMIN_EMAIL    = "admin@healthray.com";
const ADMIN_PASSWORD = "Admin@1234";      // ← Change this before running!
const ADMIN_NAME     = "Super Admin";

async function createAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log("⚠️  Admin already exists:", ADMIN_EMAIL);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      name:     ADMIN_NAME,
      email:    ADMIN_EMAIL,
      password: hashedPassword,
      role:     "admin",
    },
  });

  console.log("✅ Admin created successfully!");
  console.log("   Email   :", admin.email);
  console.log("   Role    :", admin.role);
  console.log("   ID      :", admin.id);
  console.log("\n👉 You can now log in at the login page with these credentials.");
}

createAdmin()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

