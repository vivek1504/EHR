import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../generated/prisma/client.js";
import notes from "./notes.json" with { type: "json" };
import { prisma } from "../db/client.js";

async function seed() {
  console.log("Starting seed...\n");
  const admin = await prisma.user.upsert({
    where: { email: "admin@ehr.local" },
    update: {},
    create: {
      email: "admin@ehr.local",
      name: "System Admin",
      role: "ADMIN",
    },
  });

  console.log(` Admin user: ${admin.email}`);
  console.log(` API Key:    ${admin.apiKey}\n`);

  const annotator = await prisma.user.upsert({
    where: { email: "annotator@ehr.local" },
    update: {},
    create: {
      email: "annotator@ehr.local",
      name: "Dr. Smith",
      role: "ANNOTATOR",
    },
  });

  console.log(` Annotator:  ${annotator.email}`);
  console.log(`API Key:    ${annotator.apiKey}\n`);

  const storagePath = process.env["STORAGE_PATH"] || "./data/documents";
  mkdirSync(storagePath, { recursive: true });

  for (const note of notes) {
    const storageKey = `documents/${note.id}.txt`;
    const localPath = join(storagePath, `${note.id}.txt`);
    writeFileSync(localPath, note.text, "utf-8");
    await prisma.document.upsert({
      where: { id: note.id },
      update: {},
      create: {
        id: note.id,
        title: note.title,
        category: note.category,
        storageKey,
        status: "UPLOADED",
        wordCount: note.text.split(/\s+/).length,
        uploadedById: admin.id,
      },
    });

    console.log(`Seeded: ${note.id} — ${note.title}`);
  }

  await prisma.systemFlag.upsert({
    where: { key: "maintenance_mode" },
    update: {},
    create: { key: "maintenance_mode", value: false },
  });

  console.log("\n✅ Seeding complete!");
  console.log(`   ${notes.length} documents created`);
  console.log(`   2 users created`);
  console.log(`   Use the admin API key above to authenticate requests\n`);
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
