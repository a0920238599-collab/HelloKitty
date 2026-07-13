import dotenv from 'dotenv';
dotenv.config();
console.log(process.env.DATABASE_URL ? "DATABASE_URL is set" : "No DATABASE_URL");
