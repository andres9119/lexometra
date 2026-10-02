/**
 * Calculates French amortization schedule (equal installments).
 * @param {number} principal - Total loan amount
 * @param {number} monthlyRate - Monthly interest rate as decimal (e.g. 0.02 for 2%)
 * @param {number} n - Number of installments
 * @param {string} startDate - ISO date string for first installment
 * @returns {Array} Array of installment objects
 */
export function calculateAmortization(principal, monthlyRate, n, startDate) {
  const schedule = [];
  let balance = principal;

  // If no interest, equal installments
  let installmentAmount;
  if (monthlyRate === 0) {
    installmentAmount = principal / n;
  } else {
    // French amortization: PMT = P * r / (1 - (1+r)^-n)
    installmentAmount = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  }

  const start = startDate ? new Date(startDate) : new Date();

  for (let i = 1; i <= n; i++) {
    const interest = balance * monthlyRate;
    const capital = installmentAmount - interest;
    balance = Math.max(0, balance - capital);

    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);

    schedule.push({
      installment_number: i,
      due_date: dueDate.toISOString().split("T")[0],
      interest: Math.round(interest),
      capital: Math.round(i === n ? (balance === 0 ? capital : capital + balance) : capital),
      amount: Math.round(installmentAmount),
      balance: Math.round(i === n ? 0 : balance),
      status: "pendiente",
      amount_paid: 0,
    });
  }

  // Fix last installment rounding
  const totalScheduled = schedule.reduce((s, q) => s + q.amount, 0);
  const diff = Math.round(principal * (1 + monthlyRate * n)) - totalScheduled;
  if (diff !== 0 && schedule.length > 0) {
    schedule[schedule.length - 1].amount += diff;
  }

  return schedule;
}

export function calcInstallmentAmount(principal, monthlyRate, n) {
  if (n <= 0) return 0;
  if (monthlyRate === 0) return Math.round(principal / n);
  return Math.round((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n)));
}

export function calcTotalWithInterest(principal, monthlyRate, n) {
  return Math.round(calcInstallmentAmount(principal, monthlyRate, n) * n);
}