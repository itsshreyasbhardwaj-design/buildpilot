import { seedDemoData } from "../src/lib/demo/seed-data";

seedDemoData()
  .then(() => {
    console.log("Demo data seeded.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
