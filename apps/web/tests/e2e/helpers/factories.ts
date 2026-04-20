let counter = 0;

export function uniqueEmail(prefix = 'e2e'): string {
  counter += 1;
  return `${prefix}-${counter.toString()}-${Date.now().toString()}@example.test`;
}

export const E2E_PASSWORD = 'Wq8!cVm#7yLp3xTk';
