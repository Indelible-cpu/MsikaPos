import bcrypt from 'bcryptjs';

const hash = '$2y$10$75zg4wOj9LN5O6vVt9YWiuEwhV1NArmQ73bTAjQP0uXKFXxDBV7RG';
const passwords = [
  'Jmaes2025@.',
  'James2025@.',
  'james2025@.',
  'jmaes2025@.',
  'Jmaes2025',
  'James2025',
  'Jmaes2025@',
];

async function test() {
  for (const p of passwords) {
    const isValid = await bcrypt.compare(p, hash);
    console.log(`Password: ${p} - Valid: ${isValid}`);
  }
}
test();
