import { PrismaClient } from '@prisma/client'
import { validateStateTransition } from './middleware/state-validation'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Crea il client base
const prismaBase = globalForPrisma.prisma ?? new PrismaClient()

// Estendi con validazione degli stati
export const prisma = prismaBase.$extends({
  query: {
    ordinazione: {
      async update({ model, operation, args, query }) {
        // Valida la transizione di stato prima dell'update
        await validateStateTransition(prismaBase, model, operation, args);
        return query(args);
      },
      async updateMany({ model, operation, args, query }) {
        // Valida le transizioni di stato prima dell'updateMany
        await validateStateTransition(prismaBase, model, operation, args);
        return query(args);
      }
    }
  }
}) as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma