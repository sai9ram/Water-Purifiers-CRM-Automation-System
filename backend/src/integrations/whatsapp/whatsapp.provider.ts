/**
 * WhatsApp Provider Foundation.
 * Formats reminder messages and prepares the contract for official WhatsApp Business API integration.
 * Real automated WhatsApp dispatch is intentionally disabled in Step 1.
 */
export interface WhatsAppReminderTemplateInput {
  customerName: string;
  monthlyRent: number;
  forMonth: string;
  dueDateFormatted: string;
  paymentLink: string;
}

export function formatWhatsAppRentReminder(input: WhatsAppReminderTemplateInput): string {
  return [
    `Hello ${input.customerName},`,
    '',
    'This is a friendly reminder from *Pure Home Waters*.',
    '',
    `Your monthly water purifier rental payment of *Rs.${input.monthlyRent}* is due for *${input.forMonth}*.`,
    '',
    `Rent: Rs.${input.monthlyRent}/-`,
    `Due Date: ${input.dueDateFormatted}`,
    '',
    'Please make the payment using this secure payment link:',
    input.paymentLink,
    '',
    'For any queries, feel free to reach us anytime.',
    '',
    'Thank you for choosing Pure Home Waters!',
    '- Pure Home Waters, Tirupati'
  ].join('\n');
}
