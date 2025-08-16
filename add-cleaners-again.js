// Script to add sample cleaners again for testing deletion

const sampleCleaners = [
  {
    name: "Yuki Tanaka",
    phone: "+81-90-1234-5678",
    email: "yuki.tanaka@example.com",
    flatRate: 2500,
    currency: "JPY",
    isActive: true,
    specialties: ["deep-clean", "laundry", "linen-change"]
  },
  {
    name: "Aiko Yamamoto",
    phone: "+81-90-8765-4321",
    email: "aiko.yamamoto@example.com",
    flatRate: 2200,
    currency: "JPY",
    isActive: true,
    specialties: ["bathroom-deep-clean", "kitchen-clean"]
  },
  {
    name: "Kenji Sato",
    phone: "+81-90-5555-1234",
    email: "kenji.sato@example.com",
    flatRate: 2800,
    currency: "JPY",
    isActive: true,
    specialties: ["maintenance", "deep-clean", "linen-change"]
  }
];

async function addSampleCleaners() {
  console.log('Adding sample cleaners for testing...');
  
  for (const cleaner of sampleCleaners) {
    try {
      const response = await fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/createCleaner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleaner)
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Added cleaner: ${cleaner.name} with ID: ${result.id}`);
      } else {
        console.error(`❌ Failed to add cleaner ${cleaner.name}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ Error adding cleaner ${cleaner.name}:`, error.message);
    }
  }
  
  console.log('Finished adding sample cleaners!');
}

addSampleCleaners(); 