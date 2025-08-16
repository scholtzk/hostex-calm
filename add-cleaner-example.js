// Example: Add a single cleaner via API
const newCleaner = {
  name: "Maria Garcia",
  phone: "+81-90-9999-8888",
  email: "maria.garcia@example.com",
  hourlyRate: 2300,
  currency: "JPY",
  isActive: true,
  specialties: ["bathroom-clean", "kitchen-deep-clean"],
  availability: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: false,
    friday: true,
    saturday: true,
    sunday: false
  }
};

fetch('https://us-central1-property-manager-cf570.cloudfunctions.net/createCleaner', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(newCleaner)
})
.then(response => response.json())
.then(data => console.log('Cleaner added:', data))
.catch(error => console.error('Error:', error)); 