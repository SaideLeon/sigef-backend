interface CurrencyConfig {
  symbol: string;
  name: string;
  decimal_digits: number;
}

const currencyMap: Record<string, CurrencyConfig> = {
  BRL: {
    symbol: 'R
,
    name: 'Brazilian Real',
    decimal_digits: 2,
  },
  USD: {
    symbol: '
,
    name: 'United States Dollar',
    decimal_digits: 2,
  },
  MZN: {
    symbol: 'MT',
    name: 'Metical Moçambicano',
    decimal_digits: 2,
  },
};

export function getCurrencyConfig(currencyCode: string): CurrencyConfig | undefined {
  return currencyMap[currencyCode.toUpperCase()];
}
