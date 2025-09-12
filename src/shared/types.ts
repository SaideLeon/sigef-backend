import type { 
    User as PrismaUser, 
    Product as PrismaProduct, 
    Sale as PrismaSale, 
    Debt as PrismaDebt,
    DebtStatus as PrismaDebtStatus,
    DebtType as PrismaDebtType,
    Role as PrismaRole
} from '@prisma/client';

// Re-export enums directly
export type { PrismaDebtStatus as DebtStatus, PrismaDebtType as DebtType, PrismaRole as Role };

// Define types with string dates for API serialization
export type User = Omit<PrismaUser, 'emailVerified'> & {
  emailVerified: string | null;
};

export type Product = Omit<PrismaProduct, 'createdAt'> & {
  createdAt: string;
};

export type Sale = Omit<PrismaSale, 'createdAt'> & {
  createdAt: string;
};

export type Debt = Omit<PrismaDebt, 'createdAt' | 'dueDate' | 'paidAt'> & {
  createdAt: string;
  dueDate: string | null;
  paidAt: string | null;
};

// calculateUnitCost function
export function calculateUnitCost(product: Product | PrismaProduct): { cost: number; reason?: string } {
  if (!product.initialQuantity || product.initialQuantity <= 0) {
    return { cost: product.acquisitionValue, reason: "Initial quantity is not set, using acquisition value as unit cost." };
  }
  const cost = product.acquisitionValue / product.initialQuantity;
  return { cost };
}
