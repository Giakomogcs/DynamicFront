import prisma from './registry.js';

console.log("Registry loaded:", !!prisma);
console.log("Prisma instance:", prisma);
process.exit(0);
