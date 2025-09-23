import { PrismaClient, DebtStatus, DebtType, Role, Product as PrismaProduct, Sale as PrismaSale, Debt as PrismaDebt, User as PrismaUser } from '@prisma/client';

const prisma = new PrismaClient();

// Re-export enums
export { DebtStatus, DebtType, Role };

// Tipos de payload individuais
type UserPayload = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;
type ProductPayload = NonNullable<Awaited<ReturnType<typeof prisma.product.findUnique>>>;
type SalePayload = NonNullable<Awaited<ReturnType<typeof prisma.sale.findUnique>>>;
type DebtPayload = NonNullable<Awaited<ReturnType<typeof prisma.debt.findUnique>>>;

// Tipos para API (datas como string)
export type User = Omit<UserPayload, 'emailVerified'> & { emailVerified: string | null };
export type Product = Omit<ProductPayload, 'createdAt'> & { createdAt: string };
export type Sale = Omit<SalePayload, 'createdAt'> & { createdAt: string };
export type Debt = Omit<DebtPayload, 'createdAt' | 'dueDate' | 'paidAt'> & {
  createdAt: string;
  dueDate: string | null;
  paidAt: string | null;
};

// Função de custo unitário
export function calculateUnitCost(product: Product | PrismaProduct) {
  if (!product.initialQuantity || product.initialQuantity <= 0) {
    return { cost: product.acquisitionValue, reason: "Initial quantity is not set, using acquisition value as unit cost." };
  }
  const cost = product.acquisitionValue / product.initialQuantity;
  return { cost };
}

// Funções de serialização de datas
export function serializeUser(user: UserPayload): User {
  return { ...user, emailVerified: user.emailVerified?.toISOString() ?? null };
}

export function serializeProduct(product: ProductPayload): Product {
  return { ...product, createdAt: product.createdAt.toISOString() };
}

export function serializeSale(sale: SalePayload): Sale {
  return { ...sale, createdAt: sale.createdAt.toISOString() };
}

export function serializeDebt(debt: DebtPayload): Debt {
  return { 
    ...debt, 
    createdAt: debt.createdAt.toISOString(), 
    dueDate: debt.dueDate?.toISOString() ?? null, 
    paidAt: debt.paidAt?.toISOString() ?? null 
  };
}
