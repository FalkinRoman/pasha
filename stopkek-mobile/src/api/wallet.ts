import { apiFetch } from './client';

export type WalletConfig = {
  yookassaEnabled: boolean;
  mockTopupEnabled: boolean;
  yookassaConfigured: boolean;
  currency: string;
};

export type Transaction = {
  id: string;
  type: string;
  amountRub: number;
  description: string | null;
  createdAt: string;
};

export type TopupCreateResponse = {
  mode: 'yookassa';
  paymentId: string;
  amountRub: number;
  confirmationUrl: string | null;
  status: string;
};

export type TopupMockResponse = {
  mode: 'mock';
  paymentId: string;
  amountRub: number;
  balanceRub: number;
};

export type TopupStatusResponse = {
  paymentId: string;
  status: string;
  amountRub: number;
  balanceRub: number;
};

export async function fetchWalletConfig() {
  return apiFetch<WalletConfig>('/wallet/config', { auth: true });
}

export async function fetchTransactions() {
  return apiFetch<Transaction[]>('/wallet/transactions', { auth: true });
}

export async function createTopup(amountRub: number) {
  return apiFetch<TopupCreateResponse>('/wallet/topup/create', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ amount: amountRub }),
  });
}

export async function mockTopup(amountRub: number) {
  return apiFetch<TopupMockResponse>('/wallet/topup/mock', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ amount: amountRub }),
  });
}

export async function fetchTopupStatus(paymentId: string) {
  return apiFetch<TopupStatusResponse>(`/wallet/topup/${paymentId}/status`, {
    auth: true,
  });
}
