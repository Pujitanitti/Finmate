/**
 * Local, deterministic merchant → category matcher. No external API calls.
 * Users can always override the suggestion; this only provides a default.
 */

const MERCHANT_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /swiggy|zomato|dominos|mcdonald|kfc|starbucks|cafe/i, category: "Food" },
  { pattern: /uber|ola|rapido|petrol|fuel|metro|irctc|indigo/i, category: "Transport" },
  { pattern: /netflix|spotify|hotstar|prime video|bookmyshow|pvr|inox/i, category: "Entertainment" },
  { pattern: /amazon|flipkart|myntra|ajio|nykaa/i, category: "Shopping" },
  { pattern: /electricity|water bill|gas bill|broadband|airtel|jio|vodafone|wifi/i, category: "Bills" },
  { pattern: /apollo|pharmacy|hospital|clinic|practo|medplus/i, category: "Health" },
  { pattern: /udemy|coursera|byju|unacademy|tuition|college fee/i, category: "Education" },
  { pattern: /makemytrip|goibibo|airbnb|oyo|hotel/i, category: "Travel" },
  { pattern: /salary|payroll|stipend|freelance payment/i, category: "Income" },
];

export function suggestCategory(merchant: string): string {
  const match = MERCHANT_RULES.find((rule) => rule.pattern.test(merchant));
  return match?.category ?? "Other";
}
